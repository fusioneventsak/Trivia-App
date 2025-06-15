import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Trophy, RefreshCw, Users, Clock, Lock, PlayCircle, AlertCircle, WifiOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import CountdownTimer from './ui/CountdownTimer';
import LeaderboardDisplay from './ui/LeaderboardDisplay';
import confetti from 'canvas-confetti';
import PollStateIndicator from './ui/PollStateIndicator';
import PollDisplay from './ui/PollDisplay';
import QRCodeDisplay from './ui/QRCodeDisplay';
import { getStorageUrl } from '../lib/utils';
import { usePollManager } from '../hooks/usePollManager';
import { retry, isNetworkError, getFriendlyErrorMessage } from '../lib/error-handling';
import NetworkStatus from './ui/NetworkStatus';
import ErrorBoundary from './ui/ErrorBoundary';
import MediaDisplay from './ui/MediaDisplay';

interface Player {
  id: string;
  name: string;
  score: number;
  stats?: {
    totalPoints: number;
    correctAnswers: number;
    totalAnswers: number;
    averageResponseTimeMs: number;
  };
}

interface Activation {
  id: string;
  type: 'multiple_choice' | 'text_answer' | 'poll' | 'leaderboard';
  question: string;
  options?: any[];
  correct_answer?: string;
  exact_answer?: string;
  media_type: 'none' | 'image' | 'youtube' | 'gif';
  media_url?: string;
  poll_display_type?: 'bar' | 'pie' | 'horizontal' | 'vertical';
  poll_state?: 'pending' | 'voting' | 'closed';
  poll_result_format?: 'percentage' | 'votes' | 'both';
  title?: string;
  description?: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  is_public?: boolean;
  theme?: {
    primary_color: string;
    secondary_color: string;
    background_color: string;
    text_color: string;
    container_bg_color?: string;
  };
  logo_url?: string;
  max_players?: number;
  time_limit?: number;
  timer_started_at?: string;
  show_answers?: boolean;
}

export default function Results() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme: globalTheme } = useTheme();
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentActivation, setCurrentActivation] = useState<Activation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [playerRankings, setPlayerRankings] = useState<{[key: string]: number}>({});
  const [previousRankings, setPreviousRankings] = useState<{[key: string]: number}>({});
  const [previousActivationType, setPreviousActivationType] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [activationRefreshCount, setActivationRefreshCount] = useState(0);
  const activationChannelRef = useRef<any>(null);
  const debugIdRef = useRef<string>(`results-${Math.random().toString(36).substring(2, 7)}`);
  const currentActivationIdRef = useRef<string | null>(null);
  const gameSessionChannelRef = useRef<any>(null);
  const [showNetworkStatus, setShowNetworkStatus] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Poll management
  const {
    votesByText: pollVotes,
    totalVotes,
    pollState,
    error: pollError,
    refetch: refetchPoll
  } = usePollManager({
    activationId: currentActivation?.id || null,
    playerId: null,
    roomId: room?.id || null
  });

  // Determine theme
  const activeTheme = currentActivation?.theme || room?.theme || globalTheme;

  // Check if device is mobile
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  // Calculate player rankings
  useEffect(() => {
    const rankings: {[key: string]: number} = {};
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    sortedPlayers.forEach((player, index) => {
      rankings[player.id] = index + 1;
    });
    setPlayerRankings(rankings);
  }, [players]);

  // Timer management
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (currentActivation?.time_limit && currentActivation?.timer_started_at) {
      const startTime = new Date(currentActivation.timer_started_at).getTime();
      const totalTime = currentActivation.time_limit * 1000;

      const updateTimer = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, totalTime - elapsed);
        setTimeRemaining(Math.floor(remaining / 1000));

        if (remaining <= 0) {
          setShowAnswers(true);
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }
        }
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 100);
    } else {
      setTimeRemaining(null);
      setShowAnswers(currentActivation?.show_answers !== false);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [currentActivation]);

  // Fetch room data
  const fetchRoom = async () => {
    if (!code) return;
    
    try {
      const { data, error } = await retry(async () => {
        return await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', code.toUpperCase())
          .maybeSingle();
      });

      if (error) throw error;
      if (!data) throw new Error('Room not found');
      
      setRoom(data);
      return data;
    } catch (err: any) {
      console.error('Error fetching room:', err);
      if (isNetworkError(err)) {
        setNetworkError(true);
      } else {
        setError(getFriendlyErrorMessage(err));
      }
      throw err;
    }
  };

  // Fetch players
  const fetchPlayers = async (roomId: string) => {
    try {
      const { data, error } = await retry(async () => {
        return await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .order('score', { ascending: false });
      });

      if (error) throw error;
      setPlayers(data || []);
    } catch (err: any) {
      console.error('Error fetching players:', err);
      if (isNetworkError(err)) {
        setNetworkError(true);
      }
    }
  };

  // Fetch current activation
  const fetchCurrentActivation = async (roomId: string) => {
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('current_activation')
        .eq('room_id', roomId)
        .eq('is_live', true)
        .maybeSingle();

      if (sessionError) throw sessionError;

      if (sessionData?.current_activation) {
        const { data: activationData, error: activationError } = await supabase
          .from('activations')
          .select('*')
          .eq('id', sessionData.current_activation)
          .single();

        if (activationError) throw activationError;
        
        currentActivationIdRef.current = activationData.id;
        setCurrentActivation(activationData);
        setPreviousActivationType(activationData.type);
      } else {
        currentActivationIdRef.current = null;
        setCurrentActivation(null);
      }
    } catch (err: any) {
      console.error('Error fetching activation:', err);
      if (isNetworkError(err)) {
        setNetworkError(true);
      }
    }
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const roomData = await fetchRoom();
        if (roomData) {
          await Promise.all([
            fetchPlayers(roomData.id),
            fetchCurrentActivation(roomData.id)
          ]);
        }
      } catch (err) {
        // Error already handled in individual functions
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [code]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!room?.id) return;

    // Subscribe to game session changes
    gameSessionChannelRef.current = supabase
      .channel(`game_session:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `room_id=eq.${room.id}`
        },
        () => {
          fetchCurrentActivation(room.id);
        }
      )
      .subscribe();

    // Subscribe to activation changes
    activationChannelRef.current = supabase
      .channel(`activation_changes:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activations',
          filter: `room_id=eq.${room.id}`
        },
        (payload) => {
          if (payload.new && payload.new.id === currentActivationIdRef.current) {
            setCurrentActivation(payload.new as Activation);
          }
        }
      )
      .subscribe();

    // Subscribe to player updates
    const playerChannel = supabase
      .channel(`players:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room.id}`
        },
        () => {
          fetchPlayers(room.id);
        }
      )
      .subscribe();

    return () => {
      gameSessionChannelRef.current?.unsubscribe();
      activationChannelRef.current?.unsubscribe();
      playerChannel.unsubscribe();
    };
  }, [room?.id]);

  // Refresh poll data when activation changes
  useEffect(() => {
    if (currentActivation?.type === 'poll' && currentActivation?.id) {
      refetchPoll();
    }
  }, [currentActivation?.id, currentActivation?.type, refetchPoll]);

  // Celebration effect for leaderboard
  useEffect(() => {
    if (currentActivation?.type === 'leaderboard' && players.length > 0) {
      const topPlayer = players[0];
      if (topPlayer && previousActivationType !== 'leaderboard') {
        setTimeout(() => {
          confetti({
            particleCount: 200,
            spread: 80,
            origin: { y: 0.3 }
          });
        }, 500);
      }
    }
  }, [currentActivation?.type, players, previousActivationType]);

  // Toggle debug mode with keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setDebugMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Render question media
  const renderQuestionMedia = () => {
    if (!currentActivation?.media_url || currentActivation.media_type === 'none') {
      return null;
    }

    return (
      <div className="mb-6 flex justify-center">
        {currentActivation.media_type === 'youtube' ? (
          <div className="w-full max-w-2xl rounded-lg shadow-md overflow-hidden">
            <div className="aspect-video">
              <MediaDisplay
                url={currentActivation.media_url}
                type={currentActivation.media_type}
                alt="Question media"
                className="w-full h-full"
                fallbackText="Video not available"
              />
            </div>
          </div>
        ) : (
          <MediaDisplay
            url={currentActivation.media_url}
            type={currentActivation.media_type}
            alt="Question media"
            className="max-h-96 rounded-lg shadow-md"
            fallbackText="Image not available"
          />
        )}
      </div>
    );
  };

  // Generate QR code URL for this room
  const getJoinUrl = () => {
    try {
      const baseUrl = window.location.origin;
      return `${baseUrl}/join?code=${room?.room_code || code}`;
    } catch (err) {
      console.error('Error generating join URL:', err);
      return `/join?code=${room?.room_code || code}`;
    }
  };

  if (debugMode) {
    console.log('Current state:', {
      id: debugIdRef.current,
      room,
      players: players.length,
      currentActivation: currentActivation?.id,
      activationType: currentActivation?.type,
      showAnswers,
      pollState,
      pollVotes,
      totalVotes
    });
  }

  // Network error state
  if (networkError) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen p-4 bg-theme-gradient"
        style={{ 
          background: `linear-gradient(to bottom right, ${activeTheme.primary_color}, ${activeTheme.secondary_color})` 
        }}
      >
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <WifiOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Network Error</h1>
          <p className="text-gray-600 mb-6">Unable to connect to the server. Please check your internet connection.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 text-white rounded-lg transition"
            style={{ backgroundColor: activeTheme.primary_color }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen p-4 bg-theme-gradient"
        style={{ 
          background: `linear-gradient(to bottom right, ${activeTheme.primary_color}, ${activeTheme.secondary_color})` 
        }}
      >
        <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        <p className="mt-4 text-white text-xl">Loading...</p>
      </div>
    );
  }

  // Error state
  if (error || !room) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen p-4 bg-theme-gradient"
        style={{ 
          background: `linear-gradient(to bottom right, ${activeTheme.primary_color}, ${activeTheme.secondary_color})` 
        }}
      >
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error || 'Room not found'}</p>
          <button
            onClick={() => navigate('/join')}
            className="px-6 py-3 text-white rounded-lg transition"
            style={{ backgroundColor: activeTheme.primary_color }}
          >
            Back to Join
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen p-4 bg-theme-gradient"
      style={{ 
        background: `linear-gradient(to bottom right, ${activeTheme.primary_color}, ${activeTheme.secondary_color})` 
      }}
    >
      {/* Network Status */}
      <NetworkStatus 
        show={showNetworkStatus} 
        onClose={() => setShowNetworkStatus(false)} 
      />

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            {room.logo_url && (
              <img 
                src={getStorageUrl(room.logo_url)} 
                alt="Room logo" 
                className="h-12 w-auto object-contain mr-4"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{room.name}</h1>
              <p className="text-white/70">Room Code: {room.room_code}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {timeRemaining !== null && timeRemaining > 0 && (
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                <CountdownTimer 
                  duration={timeRemaining} 
                  onComplete={() => setShowAnswers(true)}
                  size="sm"
                  showLabel={false}
                />
              </div>
            )}
            <div className="bg-white/20 px-4 py-2 rounded-lg flex items-center">
              <Users className="w-5 h-5 text-white mr-2" />
              <span className="text-white font-medium">{players.length} Players</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
        {/* Left Column - Current Activity */}
        <div className="lg:col-span-2">
          <ErrorBoundary>
            {currentActivation ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                {currentActivation.type === 'leaderboard' ? (
                  <>
                    <div className="text-center mb-6">
                      <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                      <h2 className="text-3xl font-bold text-white mb-2">Final Leaderboard</h2>
                      <p className="text-white/70">Congratulations to all participants!</p>
                    </div>
                    <LeaderboardDisplay
                      players={players}
                      currentPlayerId={null}
                      playerRankings={playerRankings}
                      previousRankings={previousRankings}
                      showFullLeaderboard={true}
                      maxPlayersToShow={10}
                      theme={activeTheme}
                    />
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-4">{currentActivation.question}</h2>
                    
                    {renderQuestionMedia()}

                    {currentActivation.type === 'poll' && (
                      <div className="mb-4">
                        <PollStateIndicator state={pollState} />
                      </div>
                    )}

                    {(currentActivation.type === 'multiple_choice' || currentActivation.type === 'text_answer') && showAnswers ? (
                      <div className="space-y-3">
                        {currentActivation.type === 'multiple_choice' && currentActivation.options?.map((option, index) => (
                          <div 
                            key={index}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              option.text === currentActivation.correct_answer
                                ? 'bg-green-500/20 border-green-400 text-white'
                                : 'bg-white/10 border-white/20 text-white/70'
                            }`}
                          >
                            <div className="flex items-center">
                              {option.media_url && option.media_type && option.media_type !== 'none' && (
                                <img
                                  src={getStorageUrl(option.media_url)}
                                  alt={option.text}
                                  className="w-16 h-16 object-cover rounded mr-3"
                                />
                              )}
                              <span className="font-medium">{option.text}</span>
                              {option.text === currentActivation.correct_answer && (
                                <span className="ml-auto text-green-400 font-bold">✓ Correct</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {currentActivation.type === 'text_answer' && currentActivation.exact_answer && (
                          <div className="p-4 rounded-lg bg-green-500/20 border-2 border-green-400 text-white">
                            <span className="font-medium">Correct Answer: {currentActivation.exact_answer}</span>
                          </div>
                        )}
                      </div>
                    ) : currentActivation.type === 'poll' ? (
                      <PollDisplay
                        options={currentActivation.options || []}
                        votes={pollVotes}
                        totalVotes={totalVotes}
                        displayType={currentActivation.poll_display_type || 'bar'}
                        pollState={pollState}
                        resultFormat={currentActivation.poll_result_format}
                        selectedAnswer=""
                        selectedOptionId=""
                        getStorageUrl={getStorageUrl}
                        themeColors={activeTheme}
                      />
                    ) : !showAnswers ? (
                      <div className="text-center py-8">
                        <Clock className="w-12 h-12 text-white/50 mx-auto mb-3" />
                        <p className="text-white/70">Waiting for answers to be revealed...</p>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 text-center">
                {room.settings?.results_page_message ? (
                  <>
                    <Trophy className="w-16 h-16 text-white/50 mx-auto mb-4" />
                    <p className="text-xl text-white">{room.settings.results_page_message}</p>
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-16 h-16 text-white/50 mx-auto mb-4" />
                    <p className="text-xl text-white">Waiting for the host to start an activity...</p>
                  </>
                )}
              </div>
            )}
          </ErrorBoundary>
        </div>

        {/* Right Column - Leaderboard & QR Code */}
        <div className="space-y-6">
          {/* QR Code */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <QRCodeDisplay 
              value={getJoinUrl()}
              size={isMobile ? 150 : 200}
              title="Join This Room"
              subtitle={`Room Code: ${room.room_code}`}
              theme={activeTheme}
              logoUrl={room.logo_url}
              className="!p-4"
            />
          </div>

          {/* Leaderboard */}
          {currentActivation?.type !== 'leaderboard' && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <Trophy className="w-5 h-5 mr-2" />
                Leaderboard
              </h3>
              <LeaderboardDisplay
                players={players}
                currentPlayerId={null}
                playerRankings={playerRankings}
                previousRankings={previousRankings}
                showFullLeaderboard={false}
                maxPlayersToShow={5}
                theme={activeTheme}
              />
            </div>
          )}
        </div>
      </div>

      {/* Debug Panel */}
      {debugMode && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-md">
          <div className="font-bold mb-2">Debug Info ({debugIdRef.current})</div>
          <div>Room ID: {room?.id}</div>
          <div>Room Code: {room?.room_code}</div>
          <div>Players: {players.length}</div>
          <div>Current Activation: {currentActivation?.id || 'None'}</div>
          <div>Type: {currentActivation?.type || 'None'}</div>
          <div>Show Answers: {showAnswers.toString()}</div>
          <div>Time Remaining: {timeRemaining || 'No timer'}</div>
          <div>Poll State: {pollState}</div>
          <div>Poll Votes: {totalVotes}</div>
          <div>Refresh Count: {activationRefreshCount}</div>
        </div>
      )}
    </div>
  );
}