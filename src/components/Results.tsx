import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
import MediaDisplay from './ui/MediaDisplay';
import { retry, isNetworkError, getFriendlyErrorMessage } from '../lib/error-handling';
import NetworkStatus from './ui/NetworkStatus';
import ErrorBoundary from './ui/ErrorBoundary';

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

interface Option {
  text: string;
  id?: string;
  media_type?: 'none' | 'image' | 'gif';
  media_url?: string;
}

interface Activation {
  id: string;
  type: 'multiple_choice' | 'text_answer' | 'poll' | 'social_wall' | 'leaderboard';
  question: string;
  options?: Option[];
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

  // Poll management
  const {
    votesByText: pollVotesByText,
    totalVotes,
    pollState,
    isLoading: pollLoading,
    lastUpdated: pollLastUpdated,
    pollingInterval,
    initializePoll,
    cleanup: cleanupPoll
  } = usePollManager(code || '', currentActivation?.id || '', 'results');

  // Initialize poll when activation changes
  useEffect(() => {
    if (currentActivation?.type === 'poll' && currentActivation.id) {
      initializePoll();
    }
    return () => {
      cleanupPoll();
    };
  }, [currentActivation?.id, currentActivation?.type]);

  // Get theme colors
  const theme = currentActivation?.theme || room?.theme || globalTheme;

  // Helper function to get join URL
  const getJoinUrl = () => {
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}/join/${code}`;
  };

  // Fetch room data
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', code)
          .single();

        if (error) throw error;
        setRoom(data);
      } catch (err) {
        console.error('Error fetching room:', err);
        setError('Failed to load room');
      }
    };

    if (code) {
      fetchRoom();
    }
  }, [code]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!code) return;

    // Subscribe to activation updates
    const activationChannel = supabase
      .channel(`room-activation-${code}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activations',
          filter: `room_code=eq.${code}`
        },
        (payload) => {
          if (payload.new && (payload.new as any).is_active) {
            setCurrentActivation(payload.new as Activation);
            setShowAnswers(false);
          } else if (payload.eventType === 'UPDATE' && !(payload.new as any).is_active) {
            setCurrentActivation(null);
          }
        }
      )
      .subscribe();

    // Subscribe to player updates
    const playerChannel = supabase
      .channel(`room-players-${code}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${code}`
        },
        () => {
          fetchPlayers();
        }
      )
      .subscribe();

    activationChannelRef.current = activationChannel;

    return () => {
      supabase.removeChannel(activationChannel);
      supabase.removeChannel(playerChannel);
    };
  }, [code]);

  // Fetch players
  const fetchPlayers = async () => {
    if (!code) return;

    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', code)
        .order('score', { ascending: false });

      if (error) throw error;
      
      setPreviousRankings(playerRankings);
      const newRankings: {[key: string]: number} = {};
      data.forEach((player, index) => {
        newRankings[player.id] = index + 1;
      });
      setPlayerRankings(newRankings);
      
      setPlayers(data);
    } catch (err) {
      console.error('Error fetching players:', err);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // Fetch current activation
        const { data: activationData, error: activationError } = await supabase
          .from('activations')
          .select('*')
          .eq('room_code', code)
          .eq('is_active', true)
          .single();

        if (!activationError && activationData) {
          setCurrentActivation(activationData);
        }

        // Fetch players
        await fetchPlayers();
      } catch (err) {
        console.error('Error fetching initial data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchInitialData();
    }
  }, [code]);

  // Timer management
  useEffect(() => {
    if (currentActivation?.time_limit && currentActivation?.timer_started_at) {
      const startTime = new Date(currentActivation.timer_started_at).getTime();
      const endTime = startTime + (currentActivation.time_limit * 1000);

      const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeRemaining(remaining);

        if (remaining === 0) {
          setShowAnswers(true);
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }
        }
      };

      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 100);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    } else {
      setTimeRemaining(null);
    }
  }, [currentActivation?.time_limit, currentActivation?.timer_started_at]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
           style={{ backgroundColor: theme.background_color }}>
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: theme.primary_color }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
           style={{ backgroundColor: theme.background_color }}>
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: theme.error_color }} />
          <p className="text-xl" style={{ color: theme.text_color }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: theme.background_color }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {room?.name || 'Game Room'}
              </h1>
              <p className="text-white/70">Room Code: {code}</p>
            </div>
            {room?.logo_url && (
              <img 
                src={getStorageUrl(room.logo_url)} 
                alt="Room logo" 
                className="h-16 w-auto"
              />
            )}
          </div>
        </div>

        {/* Network Status */}
        {showNetworkStatus && (
          <NetworkStatus 
            isConnected={!networkError}
            showDetails={true}
            onRetry={() => window.location.reload()}
          />
        )}

        {/* Current Activation */}
        <ErrorBoundary>
          {currentActivation ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6 mb-6">
              {/* Timer */}
              {timeRemaining !== null && (
                <div className="mb-4">
                  <CountdownTimer 
                    timeRemaining={timeRemaining}
                    totalTime={currentActivation.time_limit || 30}
                  />
                </div>
              )}

              {/* Media Display */}
              {currentActivation.media_url && currentActivation.media_type !== 'none' && (
                <div className="mb-6">
                  <MediaDisplay
                    mediaType={currentActivation.media_type}
                    mediaUrl={getStorageUrl(currentActivation.media_url)}
                    className="w-full rounded-lg"
                  />
                </div>
              )}

              {/* Question/Title */}
              <h2 className="text-2xl font-bold text-white mb-6">
                {currentActivation.question || currentActivation.title || 'Current Activity'}
              </h2>

              {/* Content based on type */}
              {currentActivation.type === 'leaderboard' ? (
                <LeaderboardDisplay
                  players={players}
                  showStats={true}
                  playerRankings={playerRankings}
                  previousRankings={previousRankings}
                  themeColors={theme}
                />
              ) : (
                <>
                  {/* Options for multiple choice */}
                  {currentActivation.type === 'multiple_choice' && currentActivation.options && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {currentActivation.options.map((option, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-2 ${
                            showAnswers && option.text === currentActivation.correct_answer
                              ? 'border-green-500 bg-green-500/20'
                              : 'border-white/20 bg-white/5'
                          }`}
                        >
                          {option.media_url && option.media_type !== 'none' && (
                            <MediaDisplay
                              mediaType={option.media_type || 'image'}
                              mediaUrl={getStorageUrl(option.media_url)}
                              className="w-full h-32 object-cover rounded mb-2"
                            />
                          )}
                          <p className="text-white text-lg font-medium">{option.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Poll display */}
                  {currentActivation.type === 'poll' && (
                    <div className="space-y-4">
                      <PollStateIndicator state={pollState} />
                      
                      {pollState === 'pending' ? (
                        <div className="text-center text-white">
                          <PlayCircle className="w-12 h-12 mx-auto mb-2" />
                          <p>Poll will start soon...</p>
                        </div>
                      ) : (
                        <PollDisplay
                          options={currentActivation.options || []}
                          votesByText={pollVotesByText}
                          totalVotes={totalVotes}
                          displayType={currentActivation.poll_display_type || 'bar'}
                          resultFormat={currentActivation.poll_result_format || 'percentage'}
                          isLoading={pollLoading}
                          pollState={pollState}
                          lastUpdated={pollLastUpdated}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6 mb-6 text-center">
              <Clock className="w-12 h-12 text-white/50 mx-auto mb-2" />
              <p className="text-white">Waiting for next question...</p>
            </div>
          )}
        </ErrorBoundary>
        
        {/* Join QR Code */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Join Room</h2>
            <div className="flex items-center text-white/70">
              <Users className="w-5 h-5 mr-2" />
              {players.length} {players.length === 1 ? 'Player' : 'Players'}
            </div>
          </div>
          <QRCodeDisplay url={getJoinUrl()} />
        </div>
      </div>
    </div>
  );
}