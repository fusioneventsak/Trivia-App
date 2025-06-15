import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Trophy, Clock, AlertCircle, WifiOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import CountdownTimer from './ui/CountdownTimer';
import LeaderboardDisplay from './ui/LeaderboardDisplay';
import confetti from 'canvas-confetti';
import PollDisplay from './ui/PollDisplay';
import QRCodeDisplay from './ui/QRCodeDisplay';
import { getStorageUrl } from '../lib/utils';
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
  theme?: {
    primary_color: string;
    secondary_color: string;
    background_color: string;
    text_color: string;
  };
  logo_url?: string;
  time_limit?: number;
  timer_started_at?: string;
  show_answers?: boolean;
}

export default function Results() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
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
  const [pollVotes, setPollVotes] = useState<{[key: string]: number}>({});
  const [totalVotes, setTotalVotes] = useState(0);
  const currentActivationIdRef = useRef<string | null>(null);
  const [showNetworkStatus, setShowNetworkStatus] = useState(false);

  // Determine theme
  const activeTheme = currentActivation?.theme || room?.theme || globalTheme;

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
      timerIntervalRef.current = null;
    }

    // Reset timer state
    setTimeRemaining(null);
    
    // Only show answers if host has explicitly set show_answers = true
    setShowAnswers(currentActivation?.show_answers === true);

    // Only setup timer if activation has time_limit and timer has started
    if (currentActivation?.time_limit && currentActivation?.timer_started_at && currentActivation?.show_answers !== true) {
      const startTime = new Date(currentActivation.timer_started_at).getTime();
      const totalTime = currentActivation.time_limit * 1000;

      const updateTimer = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, totalTime - elapsed);
        const remainingSeconds = Math.floor(remaining / 1000);
        
        setTimeRemaining(remainingSeconds);

        if (remaining <= 0) {
          // Timer expired - don't automatically show answers, wait for host
          setShowAnswers(currentActivation.show_answers === true);
          
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
        }
      };

      updateTimer(); // Initial update
      
      // Force immediate render to avoid flicker
      requestAnimationFrame(updateTimer);
      
      timerIntervalRef.current = setInterval(updateTimer, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [currentActivation?.time_limit, currentActivation?.timer_started_at, currentActivation?.show_answers]);

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
        
        // If it's a poll, fetch poll results
        if (activationData.type === 'poll') {
          fetchPollResults(activationData.id);
        }
      } else {
        currentActivationIdRef.current = null;
        setCurrentActivation(null);
        setPollVotes({});
        setTotalVotes(0);
      }
    } catch (err: any) {
      console.error('Error fetching activation:', err);
      if (isNetworkError(err)) {
        setNetworkError(true);
      }
    }
  };

  // Fetch poll results
  const fetchPollResults = async (activationId: string) => {
    try {
      const { data, error } = await supabase
        .from('poll_votes')
        .select('option_text')
        .eq('activation_id', activationId);

      if (error) throw error;

      // Count votes by option
      const voteCounts: {[key: string]: number} = {};
      let total = 0;
      
      data?.forEach(vote => {
        voteCounts[vote.option_text] = (voteCounts[vote.option_text] || 0) + 1;
        total++;
      });

      setPollVotes(voteCounts);
      setTotalVotes(total);
    } catch (err) {
      console.error('Error fetching poll results:', err);
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
    const gameSessionChannel = supabase
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
    const activationChannel = supabase
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

    // Subscribe to poll votes if there's an active poll
    let pollChannel: any = null;
    if (currentActivation?.type === 'poll' && currentActivation?.id) {
      pollChannel = supabase
        .channel(`poll_votes:${currentActivation.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'poll_votes',
            filter: `activation_id=eq.${currentActivation.id}`
          },
          () => {
            fetchPollResults(currentActivation.id);
          }
        )
        .subscribe();
    }

    return () => {
      gameSessionChannel.unsubscribe();
      activationChannel.unsubscribe();
      playerChannel.unsubscribe();
      if (pollChannel) {
        pollChannel.unsubscribe();
      }
    };
  }, [room?.id, currentActivation?.id, currentActivation?.type]);

  // Celebration effect for leaderboard
  useEffect(() => {
    if (currentActivation?.type === 'leaderboard' && players.length > 0) {
      setTimeout(() => {
        confetti({
          particleCount: 200,
          spread: 80,
          origin: { y: 0.3 }
        });
      }, 500);
    }
  }, [currentActivation?.type, players.length]);

  // Render question media
  const renderQuestionMedia = () => {
    if (!currentActivation?.media_url || currentActivation.media_type === 'none') {
      return null;
    }

    return (
      <div className="mb-6 flex justify-center">
        {currentActivation.media_type === 'youtube' ? (
          <div className="w-full max-w-3xl rounded-lg shadow-md overflow-hidden">
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
            className="max-h-[60vh] rounded-lg shadow-md"
            fallbackText="Image not available"
          />
        )}
      </div>
    );
  };

  // Generate QR code URL for this room
  const getJoinUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/join?code=${room?.room_code || code}`;
  };

  // Network error state
  if (networkError) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen p-4"
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
        className="flex flex-col items-center justify-center min-h-screen p-4"
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
        className="flex flex-col items-center justify-center min-h-screen p-4"
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
      className="min-h-screen p-4 flex items-center justify-center"
      style={{ 
        background: `linear-gradient(to bottom right, ${activeTheme.primary_color}, ${activeTheme.secondary_color})` 
      }}
    >
      {/* Network Status */}
      <NetworkStatus 
        show={showNetworkStatus} 
        onClose={() => setShowNetworkStatus(false)} 
      />

      {/* Main Content */}
      <div className="w-full max-w-6xl">
        <ErrorBoundary>
          {currentActivation ? (
            // Active template display
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8">
              {/* Timer display - Enhanced with NaN protection */}
              {currentActivation.time_limit && timeRemaining !== null && !isNaN(timeRemaining) && (
                <div className="flex justify-center mb-6">
                  <div className="bg-white/20 px-6 py-3 rounded-lg shadow-lg animate-pop-in">
                    {currentActivation.timer_started_at && !currentActivation.show_answers ? (
                      <CountdownTimer 
                        duration={timeRemaining} 
                        onComplete={() => {
                          // Don't automatically show answers - wait for host
                          console.log('Timer completed - waiting for host to reveal answers');
                        }}
                        size="lg"
                        showLabel={false}
                      />
                    ) : (
                      <div className="text-white text-xl font-mono">
                        {currentActivation.show_answers ? 'Time\'s Up!' : currentActivation.timer_started_at ? `${timeRemaining}s` : `${currentActivation.time_limit}s`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Leaderboard template */}
              {currentActivation.type === 'leaderboard' ? (
                <>
                  <div className="text-center mb-8">
                    <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4" />
                    <h1 className="text-4xl font-bold text-white mb-2">Leaderboard</h1>
                    <p className="text-white/70 text-xl">Congratulations to all participants!</p>
                  </div>
                  <div className="max-w-3xl mx-auto">
                    <LeaderboardDisplay
                      players={players}
                      currentPlayerId={null}
                      playerRankings={playerRankings}
                      previousRankings={previousRankings}
                      showFullLeaderboard={true}
                      maxPlayersToShow={15}
                      theme={activeTheme}
                    />
                  </div>
                </>
              ) : (
                // Question templates (multiple choice, text answer, poll)
                <>
                  <h1 className="text-3xl font-bold text-white text-center mb-6">
                    {currentActivation.question}
                  </h1>
                  
                  {renderQuestionMedia()}

                  {/* Multiple choice options */}
                  {currentActivation.type === 'multiple_choice' && currentActivation.show_answers === true && (
                    <div className="max-w-3xl mx-auto space-y-4">
                      {currentActivation.options?.map((option, index) => (
                        <div 
                          key={index}
                          className={`p-6 rounded-lg border-2 transition-all ${
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
                                className="w-20 h-20 object-cover rounded mr-4"
                              />
                            )}
                            <span className="text-xl font-medium">{option.text}</span>
                            {option.text === currentActivation.correct_answer && (
                              <span className="ml-auto text-green-400 font-bold text-xl">✓ Correct</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text answer */}
                  {currentActivation.type === 'text_answer' && currentActivation.show_answers === true && currentActivation.exact_answer && (
                    <div className="max-w-3xl mx-auto">
                      <div className="p-6 rounded-lg bg-green-500/20 border-2 border-green-400 text-white">
                        <span className="text-xl font-medium">Correct Answer: {currentActivation.exact_answer}</span>
                      </div>
                    </div>
                  )}

                  {/* Poll results */}
                  {currentActivation.type === 'poll' && (
                    <div className="max-w-3xl mx-auto">
                      <PollDisplay
                        options={currentActivation.options || []}
                        votes={pollVotes}
                        totalVotes={totalVotes}
                        displayType={currentActivation.poll_display_type || 'bar'}
                        pollState={currentActivation.poll_state || 'voting'}
                        resultFormat={currentActivation.poll_result_format}
                        selectedAnswer=""
                        selectedOptionId=""
                        getStorageUrl={getStorageUrl}
                        themeColors={activeTheme}
                      />
                    </div>
                  )}

                  {/* Waiting for answers - only show if timer is running but answers not revealed */}
                  {currentActivation.show_answers === false && currentActivation.type !== 'poll' && (
                    <div className="text-center py-12">
                      <Clock className="w-16 h-16 text-white/50 mx-auto mb-4" />
                      <p className="text-white/70 text-xl">
                        {currentActivation.timer_started_at 
                          ? 'Waiting for host to reveal answers...' 
                          : 'Waiting for timer to start...'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            // No active template - show QR code
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-12 text-center">
              <h1 className="text-3xl font-bold text-white mb-8">{room.name}</h1>
              <QRCodeDisplay 
                value={getJoinUrl()}
                size={250}
                title="Join This Room"
                subtitle={`Room Code: ${room.room_code}`}
                theme={activeTheme}
                logoUrl={room.logo_url}
                className="!p-6"
              />
              {room.settings?.results_page_message && (
                <p className="mt-8 text-xl text-white/80">
                  {room.settings.results_page_message}
                </p>
              )}
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}