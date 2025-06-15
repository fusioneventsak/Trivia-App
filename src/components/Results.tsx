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
    isLoading: pollLoading,
    pollingInterval
  } = usePollManager({
    activationId: currentActivation?.id || null,
    options: currentActivation?.options,
    playerId: null, // Results page doesn't have a player
    debugMode
  });

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  // Toggle debug mode with key sequence
  useEffect(() => {
    const keys: string[] = [];
    const debugCode = ['d', 'e', 'b', 'u', 'g'];
    
    const keyHandler = (event: KeyboardEvent) => {
      keys.push(event.key.toLowerCase());
      if (keys.length > 5) keys.shift();
      
      if (keys.join('') === debugCode.join('')) {
        setDebugMode(prev => !prev);
        console.log('Debug mode:', !debugMode);
      }
    };
    
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('keydown', keyHandler);
    };
  }, [debugMode]);

  // Add network status event listeners
  useEffect(() => {
    const handleOnline = () => setNetworkError(false);
    const handleOffline = () => setNetworkError(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch room data when code changes
  useEffect(() => {
    if (!code) return;
    
    const fetchRoom = async () => {
      try {
        setLoading(true);
        if (debugMode) console.log(`[${debugIdRef.current}] Fetching room data for code: ${code}`);
        
        // CRITICAL FIX: Check if code is a UUID or a room code
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code || '');
        
        let roomData;
        let roomError;
        
        if (isUuid) {
          console.log(`[${debugIdRef.current}] Detected UUID format, querying by ID`);
          const response = await retry(async () => {
            return await supabase
              .from('rooms')
              .select('*')
              .eq('id', code)
              .maybeSingle();
          }, 3);
          roomData = response.data;
          roomError = response.error;
        } else {
          console.log(`[${debugIdRef.current}] Detected room code format, querying by room_code`);
          const response = await retry(async () => {
            return await supabase
        // CRITICAL FIX: Check if code is a UUID or a room code
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code || '');
        
        let roomData;
        let roomError;
        
        if (isUuid) {
          console.log(`[${debugIdRef.current}] Detected UUID format, querying by ID`);
          const response = await retry(async () => {
            return await supabase
              .from('rooms')
              .select('*')
              .eq('id', code)
              .maybeSingle();
          }, 3);
          roomData = response.data;
          roomError = response.error;
        } else {
          console.log(`[${debugIdRef.current}] Detected room code format, querying by room_code`);
          const response = await retry(async () => {
            return await supabase
              .from('rooms')
              .select('*')
              .eq('room_code', code.toUpperCase())
              .maybeSingle();
          }, 3);
          roomData = response.data;
          roomError = response.error;
        }
          
        if (roomError) throw roomError;
        
        // Check if room exists
        if (debugMode) console.log(`[${debugIdRef.current}] Room data fetched:`, roomData?.name || 'Not found');
        if (!roomData) {
          throw new Error('Room not found or is inactive');
        }
        
        setRoom(roomData);
        
        // Get players for this room
        const { data: playerData, error: playerError } = await retry(async () => {
          return await supabase
            .from('players')
            .select('id, name, score, stats, room_id')
            .eq('room_id', roomData.id)
            .order('score', { ascending: false });
        }, 3);
          
        if (playerError) throw playerError;
        
        if (debugMode) {
          console.log(`[${debugIdRef.current}] Fetched ${playerData?.length || 0} players`);
          console.log('Fetched players data:', playerData);
        }
        
        setPlayers(Array.isArray(playerData) ? playerData : []);
        
        // Update rankings
        updateRankings(playerData || []);
        
        // Get current activation
        const { data: sessionData, error: sessionError } = await retry(async () => {
          return await supabase
            .from('game_sessions')
            .select('current_activation')
            .eq('room_id', roomData.id)
            .maybeSingle();
        }, 3);
          
        if (sessionError) throw sessionError;
        
        if (debugMode) console.log(`[${debugIdRef.current}] Current activation ID:`, sessionData?.current_activation || 'None');
        if (sessionData?.current_activation) {
          const { data: activation, error: activationError } = await retry(async () => {
            return await supabase
              .from('activations')
              .select('*')
              .eq('id', sessionData.current_activation)
              .limit(1)
              .single();
          }, 3);
              
          if (activationError) throw activationError;
          
          if (debugMode) console.log(`[${debugIdRef.current}] Activation fetched:`, activation?.type || 'Unknown type');
          await handleActivationChange(activation);
        } else {
          await handleActivationChange(null);
        }
        
        setLoading(false);
        
        // Set up real-time subscriptions
        setupRealtimeSubscriptions(roomData.id);
        
      } catch (err: any) {
        console.error('Error fetching room:', err);
        
        // Check if it's a network error
        if (isNetworkError(err)) {
          setShowNetworkStatus(true);
          setError('Network connection issue. Please check your internet connection.');
        } else {
          setError(getFriendlyErrorMessage(err));
        }
        
        setLoading(false);
      }
    };
    
    fetchRoom();
    
    // Clean up function
    return () => {
      // Clean up all subscriptions
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (activationChannelRef.current) {
        activationChannelRef.current.unsubscribe();
        activationChannelRef.current = null;
      }
      if (gameSessionChannelRef.current) {
        gameSessionChannelRef.current.unsubscribe();
        gameSessionChannelRef.current = null;
      }
    };
  }, [code, debugMode, activationRefreshCount]);
  
  // Handle activation change
  const handleActivationChange = async (activation: Activation | null) => {
    if (debugMode) {
      console.log(`[${debugIdRef.current}] Handling activation change:`, activation?.id);
    }
    
    // Check if this is actually a different activation
    const isNewActivation = currentActivationIdRef.current !== activation?.id;
    
    if (debugMode) {
      console.log(`[${debugIdRef.current}] Is new activation: ${isNewActivation}`);
      console.log('Current activation ID ref:', currentActivationIdRef.current);
    }
    
    // Store previous activation type before updating
    if (isNewActivation) {
      setPreviousActivationType(currentActivation?.type || null);
    }
    
    // Update current activation ID ref
    currentActivationIdRef.current = activation?.id || null;
    
    if (debugMode) console.log(`[${debugIdRef.current}] Setting current activation:`, activation?.type || 'null');
    setCurrentActivation(activation);
    
    // Setup timer if needed
    if (activation?.time_limit && activation.timer_started_at) {
      setupTimer(activation);
    } else {
      setShowAnswers(activation?.show_answers !== false);
      setTimeRemaining(null);
    }
  };
  
  // Update player rankings
  const updateRankings = (playerData: Player[]) => {
    // Save previous rankings before updating
    if (debugMode) console.log(`[${debugIdRef.current}] Updating player rankings for ${playerData.length} players`);
    if (Object.keys(playerRankings).length > 0) {
      setPreviousRankings(playerRankings);
    }
    
    // Update current rankings
    const newRanks: {[key: string]: number} = {};
    if (Array.isArray(playerData)) {
      playerData
        .sort((a, b) => b.score - a.score)
        .forEach((player, index) => {
          newRanks[player.id] = index + 1;
        });
    }
    setPlayerRankings(newRanks);
  };
  
  // Setup timer when activation changes or timer starts
  const setupTimer = (activation: Activation) => {
    if (debugMode) console.log(`[${debugIdRef.current}] Setting up timer for activation: ${activation.id}`);
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Reset timer state
    setTimeRemaining(null);
    setShowAnswers(false); // Default to hiding answers
    
    // If no activation or no time limit, show answers and return
    if (!activation || !activation.time_limit) {
      setShowAnswers(activation?.show_answers !== false);
      return;
    }
    
    // Check if timer has already started
    if (activation.timer_started_at) {
      const startTime = new Date(activation.timer_started_at).getTime();
      const currentTime = new Date().getTime();
      const elapsedMs = currentTime - startTime;
      const totalTimeMs = activation.time_limit * 1000;
      
      if (debugMode) console.log(`[${debugIdRef.current}] Timer calculation: elapsed=${elapsedMs}ms, total=${totalTimeMs}ms`);
      // If timer has already expired, show answers
      if (elapsedMs >= totalTimeMs) {
        setTimeRemaining(0);
        setShowAnswers(true); // Always show answers when timer expires
        return;
      }
      
      // Otherwise, calculate remaining time and start countdown
      const remainingMs = totalTimeMs - elapsedMs;
      setTimeRemaining(Math.ceil(remainingMs / 1000));
      setShowAnswers(false);
      if (debugMode) console.log(`[${debugIdRef.current}] Starting timer with ${Math.ceil(remainingMs / 1000)} seconds remaining`);
      
      // Start countdown timer
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 1) {
            // Time's up - clear interval and always show answers
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            
            setShowAnswers(true); // Always show answers when timer expires
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };
  
  // Set up real-time subscriptions
  const setupRealtimeSubscriptions = (roomId: string) => {
    if (debugMode) console.log(`[${debugIdRef.current}] Setting up realtime subscriptions for room: ${roomId}`);
    // Subscribe to game session changes
    gameSessionChannelRef.current = supabase
      .channel(`game_session_${roomId}`)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'game_sessions',
        filter: `room_id=eq.${roomId}`
      }, async (payload: any) => {
        if (debugMode) console.log('Game session change detected:', payload);
        
        // Check if current_activation has changed
        if (payload.new && payload.old && payload.new.current_activation !== payload.old.current_activation) {
          if (payload.new?.current_activation) {
            // Fetch fresh activation data
            const { data: activation, error } = await retry(async () => {
              return await supabase
                .from('activations')
                .select('*')
                .eq('id', payload.new.current_activation)
                .single();
            }, 3);
              
            if (!error && activation) {
              await handleActivationChange(activation);
            }
          } else {
            // Clear current activation
            await handleActivationChange(null);
          }
        }
      })
      .subscribe();

    // Subscribe to activation updates (for poll state changes)
    activationChannelRef.current = supabase
      .channel(`activation_updates_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'activations',
          filter: `room_id=eq.${roomId}`
        } as any,
        async (payload) => {
          if (currentActivationIdRef.current && payload.new.id === currentActivationIdRef.current) {
            if (debugMode) console.log('Current activation updated:', payload.new.id);
            
            // Update activation without resetting everything
            setCurrentActivation(prev => ({
              ...prev,
              ...payload.new
            }));
            
            // Update timer_started_at if it changed
            if (payload.new.timer_started_at !== payload.old?.timer_started_at && 
                payload.new.time_limit && payload.new.timer_started_at) {
              setupTimer(payload.new as Activation);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to player changes
    const playerChannel = supabase
      .channel(`players_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`
        } as any,
        async () => {
          try {
            const { data, error } = await retry(async () => {
              return await supabase
                .from('players')
                .select('id, name, score, room_id, stats')
                .eq('room_id', roomId)
                .order('score', { ascending: false });
                
            }, 3);
              
            if (error) {
              console.error('Error fetching players:', error);
              return;
            }
            
            // Ensure data is an array
            if (debugMode) console.log(`[${debugIdRef.current}] Player data updated: ${data?.length || 0} players`);
            const playerData = Array.isArray(data) ? data : [];
            
            updateRankings(playerData);
            setPlayers(playerData);
          } catch (error) {
            console.error('Error in player changes handler:', error);
          }
        }
      )
      .subscribe();
      
    // Return cleanup function
    return () => {
      if (gameSessionChannelRef.current) {
        gameSessionChannelRef.current.unsubscribe();
      }
      if (activationChannelRef.current) {
        activationChannelRef.current.unsubscribe();
      }
      if (debugMode) console.log(`[${debugIdRef.current}] Cleaned up realtime subscriptions`);
      playerChannel.unsubscribe();
    };
  };

  const renderMediaContent = () => {
    if (!currentActivation?.media_url || currentActivation.media_type === 'none') {
      if (debugMode) {
        console.log(`[${debugIdRef.current}] No media to render`);
      }
      return null;
    }
    
    if (debugMode) {
      console.log('Rendering media:', {
        id: debugIdRef.current,
        type: currentActivation.media_type,
        url: currentActivation.media_url
      });
    }
    
    return (
      <div className="flex justify-center items-center mb-4">
        <div className="rounded-lg shadow-sm bg-gray-100 p-1 overflow-hidden inline-block">
          <MediaDisplay
            url={currentActivation.media_url}
            type={currentActivation.media_type}
            alt="Question media"
            className="max-h-40 object-contain"
            fallbackText="Question media not available"
          />
        </div>
      </div>
    );
  };

  // Get room theme or use default theme
  const activeTheme = room?.theme || globalTheme;

  // Ensure theme has all required properties
  if (!activeTheme.primary_color) activeTheme.primary_color = globalTheme.primary_color || '#6366F1';
  if (!activeTheme.secondary_color) activeTheme.secondary_color = globalTheme.secondary_color || '#8B5CF6';
  if (!activeTheme.background_color) activeTheme.background_color = globalTheme.background_color || '#F3F4F6';
  if (!activeTheme.text_color) activeTheme.text_color = globalTheme.text_color || '#1F2937';

  // Add effect for confetti when leaderboard is activated
  useEffect(() => {
    // Check if the activation type has changed to leaderboard
    if (currentActivation?.type === 'leaderboard' && previousActivationType !== 'leaderboard') {
      if (debugMode) console.log(`[${debugIdRef.current}] Leaderboard activated - firing confetti`);
      // Fire confetti when leaderboard is activated
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.3 }
      });

      // Add a secondary delayed burst for more excitement
      setTimeout(() => {
        confetti({
          particleCount: 100,
          angle: 60,
          spread: 55,
          origin: { x: 0.1, y: 0.5 }
        });
        
        confetti({
          particleCount: 100,
          angle: 120,
          spread: 55,
          origin: { x: 0.9, y: 0.5 }
        });
      }, 500);
    }
  }, [currentActivation, previousActivationType, debugMode]);

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
          <p className="text-gray-600 mb-6">{error || "Room not found"}</p>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div 
      className="min-h-screen p-4 bg-theme-gradient relative"
      style={{ 
        background: `linear-gradient(to bottom right, ${activeTheme.primary_color}, ${activeTheme.secondary_color})` 
      }}
    >
      {/* Network status indicator */}
      {showNetworkStatus && (
        <div className="fixed top-0 left-0 right-0 z-50 p-2">
          <NetworkStatus 
            onRetry={() => {
              setShowNetworkStatus(false);
              setActivationRefreshCount(prev => prev + 1); // Force refresh
            }}
            pollingInterval={pollingInterval}
          />
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            {room.logo_url && (
              <img 
                src={room.logo_url} 
                alt={room.name} 
                className="h-12 w-auto object-contain mr-4"
                onError={(e) =>
                  e.currentTarget.style.display = 'none'
                }
              />
            )}
            <h1 className="text-2xl font-bold text-white">{room.name}</h1>
          </div>
          <div className="bg-white/20 px-3 py-1 rounded-full text-white text-sm">
            Room {room.room_code}
          </div>
        </div>
        
        {/* Current Activation */}
        <ErrorBoundary>
          {/* Render current activation or waiting message */}
          {currentActivation ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6 mb-6">
              {/* Timer Display */}
              {currentActivation.time_limit && currentActivation.timer_started_at && (
                <div className="mb-4 flex justify-center">
                  <CountdownTimer 
                    initialSeconds={currentActivation.time_limit}
                    startTime={currentActivation.timer_started_at}
                    variant={isMobile ? "default" : "large"}
                    onComplete={() => setShowAnswers(true)}
                    showProgressBar={true}
                  />
                </div>
              )}
              
              {currentActivation.type === 'leaderboard' ? (
                /* Leaderboard display */
                <LeaderboardDisplay 
                  roomId={room.id}
                  maxPlayers={currentActivation.max_players || 20}
                  autoRefresh={true}
                  refreshInterval={5000}
                  showStats={true}
                />
              ) : (
                /* Question/Poll display */
                <>
                  <h2 className="text-xl font-semibold text-white mb-4">{currentActivation.question}</h2>
                  
                  {renderMediaContent()}
                  
                  {/* Multiple Choice Question */}
                  {currentActivation.type === 'multiple_choice' && (
                    /* Multiple choice options */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentActivation.options?.map((option, index) => {
                        const isCorrect = option.text === currentActivation.correct_answer;
                        
                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-xl text-left transition ${
                              showAnswers && isCorrect
                                ? 'bg-green-400/30 ring-2 ring-green-400'
                                : 'bg-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {option.media_type !== 'none' && option.media_url && (
                                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-black/20">
                                  <MediaDisplay
                                    url={option.media_url}
                                    type={option.media_type}
                                    alt={option.text}
                                    className="w-full h-full object-cover"
                                    fallbackText="!"
                                  />
                                </div>
                              )}
                              
                              <div className="flex-1 font-medium text-white">{option.text}</div>
                            </div>
                            
                            {showAnswers && isCorrect && (
                              <div className="mt-2 text-sm text-green-200">
                                Correct Answer
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Text Answer Question */}
                  {currentActivation.type === 'text_answer' && (
                    /* Text answer display */
                    <div className="space-y-4">
                      {showAnswers && (
                        <div className="bg-green-400/30 p-4 rounded-xl">
                          <div className="font-medium text-white mb-1">Correct Answer:</div>
                          <div className="text-xl font-bold text-white">{currentActivation.exact_answer}</div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Poll Display */}
                  {currentActivation.type === 'poll' && (
                    <div className="space-y-4">
                      <PollDisplay
                        activation={currentActivation}
                        votes={pollVotes}
                        totalVotes={totalVotes}
                        showResults={pollState === 'closed'}
                        displayType={currentActivation.poll_display_type || 'bar'}
                        resultFormat={currentActivation.poll_result_format || 'both'}
                      />
                      
                      <div className="flex justify-center">
                        <PollStateIndicator 
                          state={pollState || 'pending'}
                          totalVotes={totalVotes}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Waiting for next question */
            <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-8 mb-6 text-center">
              <Clock className="w-16 h-16 text-white/60 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Waiting for next question...</h2>
              <p className="text-white/80">The host will activate the next question shortly.</p>
            </div>
          )}
        </ErrorBoundary>
        
        {/* QR Code and Join Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* QR Code */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6 text-center">
            <h3 className="text-lg font-semibold text-white mb-4">Join This Room</h3>
            <QRCodeDisplay 
              url={getJoinUrl()}
              size={isMobile ? 120 : 150}
              className="mx-auto mb-4"
            />
            <p className="text-white/80 text-sm">
              Scan QR code or visit:<br />
              <span className="font-mono text-white">{window.location.origin}/join</span><br />
              Room Code: <span className="font-bold text-white">{room.room_code}</span>
            </p>
          </div>
          
          {/* Room Stats */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Room Statistics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-white/60" />
                  <span className="text-white/80">Players</span>
                </div>
                <span className="text-white font-semibold">{players.length}</span>
              </div>
              
              {players.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-white/60" />
                      <span className="text-white/80">Top Score</span>
                    </div>
                    <span className="text-white font-semibold">{Math.max(...players.map(p => p.score))}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 text-center text-white/60">📊</span>
                      <span className="text-white/80">Average Score</span>
                    </div>
                    <span className="text-white font-semibold">
                      {Math.round(players.reduce((sum, p) => sum + p.score, 0) / players.length)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Current Leaderboard */}
        {players.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Current Standings</h3>
              <button
                onClick={() => setActivationRefreshCount(prev => prev + 1)}
                className="p-2 text-white/60 hover:text-white transition"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-2">
              {players.slice(0, 10).map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg transition ${
                    index < 3 
                      ? 'bg-gradient-to-r from-yellow-400/20 to-yellow-600/20' 
                      : 'bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-gray-300 text-gray-800' :
                      index === 2 ? 'bg-amber-600 text-white' :
                      'bg-white/20 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-white font-medium">{player.name}</span>
                  </div>
                  <div className="text-white font-bold">{player.score}</div>
                </div>
              ))}
            </div>
            
            {players.length > 10 && (
              <div className="mt-4 text-center">
                <span className="text-white/60 text-sm">
                  ... and {players.length - 10} more players
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Debug Info */}
        {debugMode && (
          <div className="mt-6 bg-black/50 backdrop-blur-sm rounded-lg p-4 text-xs text-white/80 font-mono">
            <div className="mb-2 font-bold">Debug Info ({debugIdRef.current}):</div>
            <div>Room ID: {room?.id}</div>
            <div>Current Activation: {currentActivation?.id || 'None'}</div>
            <div>Activation Type: {currentActivation?.type || 'None'}</div>
            <div>Show Answers: {showAnswers.toString()}</div>
            <div>Time Remaining: {timeRemaining}</div>
            <div>Poll State: {pollState || 'N/A'}</div>
            <div>Poll Votes: {totalVotes}</div>
            <div>Players: {players.length}</div>
            <div>Network Error: {networkError.toString()}</div>
            <div>Refresh Count: {activationRefreshCount}</div>
          </div>
        )}
      </div>
    </div>
  );
}