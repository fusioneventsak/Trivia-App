// Fixed Game.tsx - Key changes to resolve mobile timer and premature answer reveal

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';
import { useTheme } from '../context/ThemeContext';
import { Clock, Loader2, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import PointsDisplay from './ui/PointsDisplay';
import CountdownTimer from './ui/CountdownTimer';
import MediaDisplay from './ui/MediaDisplay';
import LeaderboardDisplay from './ui/LeaderboardDisplay';
import PollDisplay from './ui/PollDisplay';
import ErrorBoundary from './ui/ErrorBoundary';
import NetworkStatus from './ui/NetworkStatus';
import { usePollManager } from '../hooks/usePollManager';

// CRITICAL FIX: Enhanced timer state management
interface TimerState {
  isActive: boolean;
  timeRemaining: number | null;
  hasExpired: boolean;
  startedAt: string | null;
  totalTime: number | null;
}

const Game: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { 
    currentPlayerId, 
    playerScore, 
    setPlayerScore, 
    updatePlayerScore 
  } = useGameStore();

  // Core state
  const [room, setRoom] = useState<any>(null);
  const [currentActivation, setCurrentActivation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Answer state
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<number | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number>(0);
  const [showPointAnimation, setShowPointAnimation] = useState(false);

  // CRITICAL FIX: Enhanced timer state management
  const [timerState, setTimerState] = useState<TimerState>({
    isActive: false,
    timeRemaining: null,
    hasExpired: false,
    startedAt: null,
    totalTime: null
  });

  // UI state
  const [showAnswers, setShowAnswers] = useState(false);
  const [showNetworkStatus, setShowNetworkStatus] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Pending rewards state
  const [pendingPoints, setPendingPoints] = useState<number>(0);
  const [pendingCorrect, setPendingCorrect] = useState<boolean>(false);
  const [pendingResponseTime, setPendingResponseTime] = useState<number>(0);
  const [hasPendingReward, setHasPendingReward] = useState(false);

  // Debug
  const [debugId] = useState(`game-${Math.random().toString(36).substring(2, 7)}`);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivationIdRef = useRef<string | null>(null);

  // Poll management
  const {
    votesByText: pollVotes,
    totalVotes,
    hasVoted: pollVoted,
    selectedOptionId: pollSelectedOptionId,
    pollState,
    submitVote: submitPollVote,
    isLoading: pollLoading
  } = usePollManager({
    activationId: currentActivation?.id || null,
    options: currentActivation?.options,
    playerId: currentPlayerId
  });

  // CRITICAL FIX: Robust timer result revelation logic
  const canRevealResults = () => {
    // If there's no timer configured, can show immediately
    if (!timerState.isActive && !timerState.startedAt) {
      console.log(`[${debugId}] 🟢 No timer configured - can reveal results immediately`);
      return true;
    }
    
    // If timer has explicitly expired, can show
    if (timerState.hasExpired) {
      console.log(`[${debugId}] 🟢 Timer expired - can reveal results now`);
      return true;
    }
    
    // If timer is active but we're past the expiration time, also allow
    if (timerState.startedAt && timerState.totalTime) {
      const startTime = new Date(timerState.startedAt).getTime();
      const currentTime = new Date().getTime();
      const elapsedMs = currentTime - startTime;
      const totalTimeMs = timerState.totalTime * 1000;
      
      if (elapsedMs >= totalTimeMs) {
        console.log(`[${debugId}] 🟢 Timer should have expired (${elapsedMs}ms >= ${totalTimeMs}ms) - can reveal results`);
        return true;
      }
    }
    
    console.log(`[${debugId}] 🔴 Timer active - CANNOT reveal results`, {
      isActive: timerState.isActive,
      hasExpired: timerState.hasExpired,
      timeRemaining: timerState.timeRemaining,
      startedAt: timerState.startedAt,
      totalTime: timerState.totalTime
    });
    return false;
  };

  // CRITICAL FIX: Enhanced mobile detection with more aggressive checking
  useEffect(() => {
    const checkMobile = () => {
      // Multiple mobile detection methods for better reliability
      const screenWidth = window.innerWidth;
      const userAgent = navigator.userAgent;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      const mobile = screenWidth < 768 || 
                   /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
                   (isTouchDevice && screenWidth < 1024);
      
      setIsMobile(mobile);
      console.log(`[${debugId}] Device detection: ${mobile ? 'MOBILE' : 'DESKTOP'}`, {
        screenWidth,
        isTouchDevice,
        userAgent: userAgent.substring(0, 50) + '...'
      });
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, [debugId]);

  // CRITICAL FIX: Enhanced timer setup with better state management
  const setupTimer = (activation: any) => {
    console.log(`[${debugId}] 🔧 Setting up timer:`, {
      id: activation.id,
      time_limit: activation.time_limit,
      timer_started_at: activation.timer_started_at,
      type: activation.type
    });
    
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Reset all timer and answer states
    setTimerState({
      isActive: false,
      timeRemaining: null,
      hasExpired: false,
      startedAt: null,
      totalTime: null
    });
    setShowAnswers(false);
    setShowResult(false);
    setShowPointAnimation(false);
    setPendingPoints(0);
    setPendingCorrect(false);
    setPendingResponseTime(0);
    setHasPendingReward(false);
    
    // If no time limit, no timer needed
    if (!activation.time_limit) {
      console.log(`[${debugId}] ❌ No time limit - no timer needed`);
      setShowAnswers(activation.show_answers !== false);
      return;
    }
    
    // Check if timer has already started
    if (activation.timer_started_at) {
      const startTime = new Date(activation.timer_started_at).getTime();
      const currentTime = new Date().getTime();
      const elapsedMs = currentTime - startTime;
      const totalTimeMs = activation.time_limit * 1000;
      
      console.log(`[${debugId}] ⏱️ Timer calculation:`, {
        startTime: new Date(activation.timer_started_at).toISOString(),
        currentTime: new Date().toISOString(),
        elapsedMs,
        totalTimeMs,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
        totalSeconds: activation.time_limit
      });
      
      // If timer has already expired
      if (elapsedMs >= totalTimeMs) {
        console.log(`[${debugId}] ✅ Timer already expired`);
        setTimerState({
          isActive: false,
          timeRemaining: 0,
          hasExpired: true,
          startedAt: activation.timer_started_at,
          totalTime: activation.time_limit
        });
        setShowAnswers(true);
        return;
      }
      
      // Timer is active - calculate remaining time
      const remainingMs = totalTimeMs - elapsedMs;
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      
      console.log(`[${debugId}] 🚀 Starting active timer: ${remainingSeconds} seconds remaining`);
      
      setTimerState({
        isActive: true,
        timeRemaining: remainingSeconds,
        hasExpired: false,
        startedAt: activation.timer_started_at,
        totalTime: activation.time_limit
      });
      setShowAnswers(false);
      
      // Start countdown
      timerIntervalRef.current = setInterval(() => {
        setTimerState(prevState => {
          const newTimeRemaining = prevState.timeRemaining !== null ? prevState.timeRemaining - 1 : 0;
          
          if (newTimeRemaining <= 0) {
            console.log(`[${debugId}] 🎯 TIMER COMPLETED!!! Setting hasExpired = true`);
            
            // Clear interval
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            
            // Mark timer as expired and show answers
            setShowAnswers(true);
            
            return {
              ...prevState,
              isActive: false,
              timeRemaining: 0,
              hasExpired: true
            };
          }
          
          return {
            ...prevState,
            timeRemaining: newTimeRemaining
          };
        });
      }, 1000);
    } else {
      console.log(`[${debugId}] ⏳ Timer not started yet`);
      setTimerState({
        isActive: false,
        timeRemaining: activation.time_limit,
        hasExpired: false,
        startedAt: null,
        totalTime: activation.time_limit
      });
      setShowAnswers(false);
    }
  };

  // CRITICAL FIX: Watch for timer expiration to reveal results
  useEffect(() => {
    if (timerState.hasExpired && hasAnswered && !showResult && 
        (currentActivation?.type === 'multiple_choice' || currentActivation?.type === 'text_answer')) {
      console.log(`[${debugId}] 🎉 Timer expired - revealing results and points!`);
      setShowResult(true);
      
      // Award pending points if we have them
      if (hasPendingReward) {
        console.log(`[${debugId}] 💰 Awarding pending points: ${pendingPoints}`);
        
        // Update database with pending points
        updatePlayerScoreInDB(pendingPoints, pendingCorrect, pendingResponseTime);
        
        // Update UI
        setPointsEarned(pendingPoints);
        
        // Only show animation if correct
        if (pendingCorrect && pendingPoints > 0) {
          setShowPointAnimation(true);
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
        
        // Clear pending reward
        setHasPendingReward(false);
      } else if (isCorrect && pointsEarned > 0) {
        setShowPointAnimation(true);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  }, [timerState.hasExpired, hasAnswered, showResult, isCorrect, pointsEarned, currentActivation, debugId, hasPendingReward, pendingPoints, pendingCorrect, pendingResponseTime]);

  // CRITICAL FIX: Enhanced answer handling with proper timer checks
  const handleMultipleChoiceAnswer = async (answer: string, optionId?: string) => {
    if (hasAnswered || !currentActivation || !currentPlayerId) return;
    
    console.log(`[${debugId}] 🎯 Multiple choice answer: "${answer}"`);
    console.log(`[${debugId}] 🔒 Can reveal results: ${canRevealResults()}`);
    
    setSelectedAnswer(answer);
    if (optionId) setSelectedOptionId(optionId);
    setHasAnswered(true);
    
    const responseTime = responseStartTime ? Date.now() - responseStartTime : 0;
    const isAnswerCorrect = answer === currentActivation.correct_answer;
    setIsCorrect(isAnswerCorrect);
    
    // Calculate points but NEVER show them until timer expires
    let calculatedPoints = 0;
    if (isAnswerCorrect) {
      const basePoints = 100;
      const timeBonus = getTimeBonus(responseTime);
      calculatedPoints = calculatePoints(basePoints, timeBonus);
      
      // Store points for later award
      setPendingPoints(calculatedPoints);
      setPendingCorrect(true);
      setPendingResponseTime(responseTime);
      setHasPendingReward(true);
      
      console.log(`[${debugId}] 💰 Points calculated: ${calculatedPoints} (HIDDEN until timer expires)`);
    }
    
    // Only update database and show results if we can reveal results immediately
    if (canRevealResults()) {
      console.log(`[${debugId}] ✅ Updating database and revealing results immediately`);
      await updatePlayerScoreInDB(calculatedPoints, isAnswerCorrect, responseTime);
      setPointsEarned(calculatedPoints);
      setShowResult(true);
      
      if (isAnswerCorrect && calculatedPoints > 0) {
        setShowPointAnimation(true);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } else {
      console.log(`[${debugId}] ⏳ Database update and results reveal delayed until timer expires`);
    }
  };

  const handleTextAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasAnswered || !currentActivation || !currentPlayerId || !textAnswer.trim()) return;
    
    console.log(`[${debugId}] 📝 Text answer: "${textAnswer}"`);
    console.log(`[${debugId}] 🔒 Can reveal results: ${canRevealResults()}`);
    
    setHasAnswered(true);
    
    const responseTime = responseStartTime ? Date.now() - responseStartTime : 0;
    const userAnswer = textAnswer.trim().toLowerCase();
    const correctAnswer = currentActivation.exact_answer?.trim().toLowerCase() || '';
    const isAnswerCorrect = userAnswer === correctAnswer;
    
    setIsCorrect(isAnswerCorrect);
    
    // Calculate points but NEVER show them until timer expires
    let calculatedPoints = 0;
    if (isAnswerCorrect) {
      const basePoints = 150;
      const timeBonus = getTimeBonus(responseTime);
      calculatedPoints = calculatePoints(basePoints, timeBonus);
      
      // Store points for later award
      setPendingPoints(calculatedPoints);
      setPendingCorrect(true);
      setPendingResponseTime(responseTime);
      setHasPendingReward(true);
      
      console.log(`[${debugId}] 💰 Points calculated: ${calculatedPoints} (HIDDEN until timer expires)`);
    }
    
    // Only update database and show results if we can reveal results immediately
    if (canRevealResults()) {
      console.log(`[${debugId}] ✅ Updating database and revealing results immediately`);
      await updatePlayerScoreInDB(calculatedPoints, isAnswerCorrect, responseTime);
      setPointsEarned(calculatedPoints);
      setShowResult(true);
      
      if (isAnswerCorrect && calculatedPoints > 0) {
        setShowPointAnimation(true);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } else {
      console.log(`[${debugId}] ⏳ Database update and results reveal delayed until timer expires`);
    }
  };

  // Helper functions
  const getTimeBonus = (responseTime: number) => {
    const maxBonus = 50;
    const timeLimit = 30000; // 30 seconds
    return Math.max(0, Math.round(maxBonus * (1 - responseTime / timeLimit)));
  };

  const calculatePoints = (basePoints: number, timeBonus: number) => {
    return basePoints + timeBonus;
  };

  const updatePlayerScoreInDB = async (points: number, isCorrect: boolean, responseTimeMs: number) => {
    try {
      console.log(`[${debugId}] Updating score in database: +${points} points`);
      
      if (!currentPlayerId) return;
      
      // Update player score
      const { error: updateError } = await supabase
        .from('players')
        .update({ 
          score: playerScore + points,
          stats: {
            totalPoints: playerScore + points,
            correctAnswers: isCorrect ? 1 : 0,
            totalAnswers: 1,
            averageResponseTimeMs: responseTimeMs
          }
        })
        .eq('id', currentPlayerId);
      
      if (updateError) throw updateError;
      
      // Update local state
      setPlayerScore(playerScore + points);
      
    } catch (err: any) {
      console.error('Error updating player score:', err);
      setError('Failed to update score');
    }
  };

  // Fetch room and activation data
  const fetchRoomAndActivation = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!roomId) {
        setError('Room ID is required');
        return;
      }
      
      // Fetch room data
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      
      if (roomError) throw roomError;
      setRoom(roomData);
      
      // Fetch current activation
      const { data: activationData, error: activationError } = await supabase
        .from('activations')
        .select('*')
        .eq('room_id', roomId)
        .eq('active', true)
        .single();
      
      if (activationError && activationError.code !== 'PGRST116') {
        throw activationError;
      }
      
      setCurrentActivation(activationData);
      
    } catch (err: any) {
      console.error('Error fetching room data:', err);
      setError(err.message || 'Failed to load room data');
    } finally {
      setLoading(false);
    }
  };

  const resetAnswerState = () => {
    setSelectedAnswer('');
    setSelectedOptionId('');
    setTextAnswer('');
    setHasAnswered(false);
    setShowResult(false);
    setIsCorrect(false);
    setResponseStartTime(null);
    setPointsEarned(0);
    setShowPointAnimation(false);
  };

  // Setup subscriptions and fetch data on mount
  useEffect(() => {
    if (!currentPlayerId) {
      navigate('/join', { 
        state: { 
          roomId, 
          message: 'Please join the room first'
        }
      });
      return;
    }
    
    fetchRoomAndActivation();
    
    // Subscribe to room changes
    const roomSubscription = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      }, (payload) => {
        console.log('Room updated:', payload);
        if (payload.new) {
          setRoom(payload.new);
        }
      })
      .subscribe();
    
    // Subscribe to activation changes
    const activationSubscription = supabase
      .channel(`activations-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activations',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        console.log('Activation updated:', payload);
        if (payload.new && payload.new.active) {
          setCurrentActivation(payload.new);
        } else if (payload.old && payload.old.active && !payload.new?.active) {
          setCurrentActivation(null);
        }
      })
      .subscribe();
    
    return () => {
      roomSubscription.unsubscribe();
      activationSubscription.unsubscribe();
    };
  }, [currentPlayerId, roomId, navigate]);

  // Handle activation changes
  useEffect(() => {
    if (currentActivation && currentActivation.id !== lastActivationIdRef.current) {
      console.log(`[${debugId}] 🔄 New activation detected:`, currentActivation.id);
      lastActivationIdRef.current = currentActivation.id;
      
      // Reset answer state for new activation
      resetAnswerState();
      
      // Setup timer for new activation
      setupTimer(currentActivation);
      
      // Start response timer
      setResponseStartTime(Date.now());
    }
  }, [currentActivation, debugId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, []);

  // Loading and error states
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-600 to-blue-600">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
          <p className="text-white text-xl">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/join')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Join
          </button>
        </div>
      </div>
    );
  }

  const roomTheme = room?.theme || theme;
  
  // CRITICAL FIX: Enhanced timer visibility logic
  const shouldShowTimer = timerState.isActive && timerState.timeRemaining !== null && timerState.timeRemaining >= 0;

  return (
    <div 
      className="min-h-screen p-4 relative"
      style={{ 
        background: `linear-gradient(to bottom right, ${roomTheme.primary_color || '#6366F1'}, ${roomTheme.secondary_color || '#8B5CF6'})` 
      }}
    >
      {/* Network status indicator */}
      {showNetworkStatus && (
        <div className="fixed top-0 left-0 right-0 z-50 p-2">
          <NetworkStatus 
            onRetry={() => {
              setShowNetworkStatus(false);
              fetchRoomAndActivation();
            }}
          />
        </div>
      )}
      
      {/* CRITICAL FIX: Enhanced mobile timer with forced visibility */}
      {shouldShowTimer && isMobile && (
        <div className="fixed top-4 left-4 right-4 z-[9999] flex justify-center pointer-events-none">
          <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl border-4 border-yellow-400 animate-pulse pointer-events-auto">
            <div className="flex items-center justify-center text-2xl font-bold">
              <Clock className="w-8 h-8 mr-3 text-yellow-300 flex-shrink-0" />
              <span className="text-3xl tabular-nums font-mono">
                {timerState.timeRemaining !== null ? (
                  `${Math.floor(timerState.timeRemaining / 60)}:${(timerState.timeRemaining % 60).toString().padStart(2, '0')}`
                ) : '0:00'}
              </span>
            </div>
            <div className="text-center text-yellow-200 text-sm mt-1 font-medium">
              Time Remaining
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* Header - Add top margin on mobile when timer is showing */}
        <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 ${shouldShowTimer && isMobile ? 'mt-24' : ''}`}>
          <div className="flex items-center">
            {room?.logo_url && (
              <img 
                src={room.logo_url} 
                alt={room.name} 
                className="h-8 sm:h-10 w-auto object-contain mr-3"
              />
            )}
            <h1 className="text-lg sm:text-xl font-bold text-white">{room?.name}</h1>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <PointsDisplay 
              points={playerScore} 
              className="text-white text-sm sm:text-base" 
              showIcon={true}
            />
            
            {/* DESKTOP TIMER */}
            {shouldShowTimer && !isMobile && (
              <div className="flex items-center px-4 py-2 bg-red-500/20 backdrop-blur-sm rounded-full text-white font-mono border border-red-400/50">
                <Clock className="w-5 h-5 mr-2 text-red-300" />
                <span className="font-bold text-lg tabular-nums">
                  {timerState.timeRemaining !== null ? (
                    `${Math.floor(timerState.timeRemaining / 60)}:${(timerState.timeRemaining % 60).toString().padStart(2, '0')}`
                  ) : '0:00'}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Current Activation */}
        {currentActivation ? (
          <ErrorBoundary
            fallback={
              <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-white/50 mx-auto mb-4" />
                <p className="text-xl text-white mb-4">There was an error loading this content</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30"
                >
                  Reload Page
                </button>
              </div>
            }
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-4 sm:p-6">
              {/* Multiple choice questions */}
              {currentActivation.type === 'multiple_choice' && (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center">
                    {currentActivation.question}
                  </h2>
                  
                  {/* Media display */}
                  {currentActivation.media_url && (
                    <div className="mb-6">
                      <MediaDisplay 
                        mediaType={currentActivation.media_type}
                        mediaUrl={currentActivation.media_url}
                      />
                    </div>
                  )}
                  
                  {/* Answer options */}
                  <div className="grid gap-3 sm:gap-4">
                    {currentActivation.options?.map((option: any, index: number) => (
                      <button
                        key={option.id || index}
                        onClick={() => handleMultipleChoiceAnswer(option.text, option.id)}
                        disabled={hasAnswered}
                        className={`p-4 rounded-lg text-left transition-all duration-200 font-medium text-lg
                          ${hasAnswered 
                            ? selectedAnswer === option.text
                              ? showResult && isCorrect && option.text === currentActivation.correct_answer
                                ? 'bg-green-500 text-white'
                                : showResult && !isCorrect && option.text === selectedAnswer
                                ? 'bg-red-500 text-white'
                                : showResult && option.text === currentActivation.correct_answer
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-300 text-gray-600'
                              : showResult && option.text === currentActivation.correct_answer
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-300 text-gray-600'
                            : 'bg-white hover:bg-blue-50 border-2 border-transparent hover:border-blue-300'
                          }`}
                      >
                        <span className="flex items-center">
                          <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 font-bold">
                            {String.fromCharCode(65 + index)}
                          </span>
                          {option.text}
                        </span>
                      </button>
                    ))}
                  </div>
                  
                  {/* Results display */}
                  {showResult && (
                    <div className="mt-6 text-center">
                      <div className={`text-2xl font-bold mb-2 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {isCorrect ? '✅ Correct!' : '❌ Incorrect'}
                      </div>
                      {!isCorrect && (
                        <div className="text-white mb-2">
                          Correct answer: {currentActivation.correct_answer}
                        </div>
                      )}
                      {pointsEarned > 0 && (
                        <div className="text-yellow-400 text-xl font-bold">
                          +{pointsEarned} points!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Text answer type */}
              {currentActivation.type === 'text_answer' && (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center">
                    {currentActivation.question}
                  </h2>
                  
                  {/* Media display */}
                  {currentActivation.media_url && (
                    <div className="mb-6">
                      <MediaDisplay 
                        mediaType={currentActivation.media_type}
                        mediaUrl={currentActivation.media_url}
                      />
                    </div>
                  )}
                  
                  <form onSubmit={handleTextAnswerSubmit}>
                    <input
                      type="text"
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      disabled={hasAnswered}
                      placeholder="Type your answer here..."
                      className="w-full p-4 text-lg rounded-lg mb-4 border-2 border-gray-300 focus:border-blue-500 focus:outline-none disabled:bg-gray-200"
                    />
                    
                    <button
                      type="submit"
                      disabled={hasAnswered || !textAnswer.trim()}
                      className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {hasAnswered ? 'Answer Submitted' : 'Submit Answer'}
                    </button>
                  </form>
                  
                  {/* Results display */}
                  {showResult && (
                    <div className="mt-6 text-center">
                      <div className={`text-2xl font-bold mb-2 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {isCorrect ? '✅ Correct!' : '❌ Incorrect'}
                      </div>
                      {!isCorrect && (
                        <div className="text-white mb-2">
                          Correct answer: {currentActivation.exact_answer}
                        </div>
                      )}
                      {pointsEarned > 0 && (
                        <div className="text-yellow-400 text-xl font-bold">
                          +{pointsEarned} points!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Poll type */}
              {currentActivation.type === 'poll' && (
                <PollDisplay
                  activation={currentActivation}
                  playerId={currentPlayerId}
                  onVote={submitPollVote}
                  votes={pollVotes}
                  totalVotes={totalVotes}
                  hasVoted={pollVoted}
                  selectedOptionId={pollSelectedOptionId}
                  pollState={pollState}
                  isLoading={pollLoading}
                />
              )}
              
              {/* Leaderboard type */}
              {currentActivation.type === 'leaderboard' && (
                <LeaderboardDisplay roomId={roomId!} />
              )}
            </div>
          </ErrorBoundary>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-6 text-center">
            <div className="text-white text-xl mb-4">Waiting for next question...</div>
            <div className="text-white/70">The host will activate the next question shortly.</div>
          </div>
        )}
      </div>
      
      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs max-w-xs">
          <div>Timer Active: {timerState.isActive.toString()}</div>
          <div>Time Remaining: {timerState.timeRemaining}</div>
          <div>Timer Expired: {timerState.hasExpired.toString()}</div>
          <div>Show Timer: {shouldShowTimer.toString()}</div>
          <div>Mobile: {isMobile.toString()}</div>
          <div>Can Reveal: {canRevealResults().toString()}</div>
        </div>
      )}
    </div>
  );
};

export default Game;