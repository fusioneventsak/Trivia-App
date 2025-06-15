// Complete Fixed Game.tsx with all missing pieces
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';
import { calculatePoints, getTimeBonus } from '../lib/point-calculator';
import { CheckCircle, XCircle, Send, AlertCircle, Trophy, Clock, Users, ChevronRight, Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import MediaDisplay from './ui/MediaDisplay';
import CountdownTimer from './ui/CountdownTimer';
import PointAnimation from './ui/PointAnimation';
import PointsDisplay from './ui/PointsDisplay';
import LeaderboardDisplay from './ui/LeaderboardDisplay';
import PollDisplay from './ui/PollDisplay';
import confetti from 'canvas-confetti';
import { getStorageUrl } from '../lib/utils';
import { usePollManager } from '../hooks/usePollManager';
import { retry, isNetworkError, getFriendlyErrorMessage } from '../lib/error-handling';
import NetworkStatus from './ui/NetworkStatus';
import ErrorBoundary from './ui/ErrorBoundary';

interface Option {
  text: string;
  id?: string;
  media_type?: 'none' | 'image' | 'gif';
  media_url?: string;
}

interface Activation {
  id: string;
  type: 'multiple_choice' | 'text_answer' | 'poll' | 'leaderboard';
  question: string;
  options?: Option[];
  correct_answer?: string;
  exact_answer?: string;
  media_type: 'none' | 'image' | 'youtube' | 'gif';
  media_url?: string;
  poll_display_type?: 'bar' | 'pie' | 'horizontal' | 'vertical';
  poll_state?: 'pending' | 'voting' | 'closed';
  poll_result_format?: 'percentage' | 'votes' | 'both';
  time_limit?: number;
  show_answers?: boolean;
  timer_started_at?: string;
}

// CRITICAL FIX: Enhanced timer state management
interface TimerState {
  isActive: boolean;
  timeRemaining: number | null;
  hasExpired: boolean;
  startedAt: string | null;
  totalTime: number | null;
}

export default function Game() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { currentPlayerId, addPlayer, updatePlayerScore, getCurrentPlayer } = useGameStore();
  
  // Core state
  const [currentActivation, setCurrentActivation] = useState<Activation | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [textAnswer, setTextAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [pointsEarned, setPointsEarned] = useState<number>(0);
  const [showPointAnimation, setShowPointAnimation] = useState(false);
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [responseStartTime, setResponseStartTime] = useState<number | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [showNetworkStatus, setShowNetworkStatus] = useState(false);

  // CRITICAL FIX: Consolidated timer state
  const [timerState, setTimerState] = useState<TimerState>({
    isActive: false,
    timeRemaining: null,
    hasExpired: false,
    startedAt: null,
    totalTime: null
  });

  // Legacy timer state for compatibility (can be removed after full migration)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [hasActiveTimer, setHasActiveTimer] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);

  // Pending rewards state
  const [pendingPoints, setPendingPoints] = useState<number>(0);
  const [pendingCorrect, setPendingCorrect] = useState<boolean>(false);
  const [pendingResponseTime, setPendingResponseTime] = useState<number>(0);
  const [hasPendingReward, setHasPendingReward] = useState(false);

  // UI state
  const [isMobile, setIsMobile] = useState(false);
  const [debugId] = useState(`game-${Math.random().toString(36).substring(2, 7)}`);
  
  // Refs
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

  // CRITICAL FIX: Enhanced result revelation logic
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
    
    // Double-check timer expiration using server time
    if (timerState.startedAt && timerState.totalTime) {
      const startTime = new Date(timerState.startedAt).getTime();
      const currentTime = new Date().getTime();
      const elapsedMs = currentTime - startTime;
      const totalTimeMs = timerState.totalTime * 1000;
      
      if (elapsedMs >= totalTimeMs) {
        console.log(`[${debugId}] 🟢 Timer should have expired (server time check) - can reveal results`);
        return true;
      }
    }
    
    // Fallback to legacy timer state for compatibility
    if (!hasActiveTimer || timerExpired) {
      console.log(`[${debugId}] 🟢 Legacy timer check - can reveal results`);
      return true;
    }
    
    console.log(`[${debugId}] 🔴 Timer active - CANNOT reveal results`, {
      timerActive: timerState.isActive,
      timerExpired: timerState.hasExpired,
      timeRemaining: timerState.timeRemaining,
      legacyActive: hasActiveTimer,
      legacyExpired: timerExpired
    });
    return false;
  };

  // CRITICAL FIX: Enhanced mobile detection
  useEffect(() => {
    const checkMobile = () => {
      // Multiple detection methods for better reliability
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
  const setupTimer = (activation: Activation) => {
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
    
    // Legacy state updates for compatibility
    setTimeRemaining(null);
    setHasActiveTimer(false);
    setTimerExpired(false);
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
        // Legacy compatibility
        setTimeRemaining(0);
        setHasActiveTimer(false);
        setTimerExpired(true);
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
      
      // Legacy compatibility
      setTimeRemaining(remainingSeconds);
      setHasActiveTimer(true);
      setTimerExpired(false);
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
            
            // Update legacy states
            setTimeRemaining(0);
            setHasActiveTimer(false);
            setTimerExpired(true);
            setShowAnswers(true);
            
            return {
              ...prevState,
              isActive: false,
              timeRemaining: 0,
              hasExpired: true
            };
          }
          
          // Update legacy state
          setTimeRemaining(newTimeRemaining);
          
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
      // Legacy compatibility
      setTimeRemaining(activation.time_limit);
      setHasActiveTimer(false);
      setTimerExpired(false);
      setShowAnswers(false);
    }
  };

  // CRITICAL FIX: Enhanced answer handling
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

  // Poll voting (no points)
  const handlePollVote = async (answer: string, optionId?: string) => {
    if (!currentActivation || !currentPlayerId) {
      console.log(`[${debugId}] Cannot submit poll vote - missing activation or player ID`);
      setError('Unable to submit vote. Missing activation or player ID.');
      return;
    }
    
    if (!optionId) {
      const option = currentActivation.options?.find(opt => opt.text === answer);
      if (!option?.id) {
        setError('Invalid option selected');
        return;
      }
      optionId = option.id;
    }
    
    console.log(`[${debugId}] 🗳️ Poll vote: ${answer} (no points awarded)`);
    
    setSelectedAnswer(answer);
    setSelectedOptionId(optionId);
    
    const result = await submitPollVote(optionId);
    
    if (result.success) {
      console.log(`[${debugId}] ✅ Poll vote submitted - no points awarded`);
    } else {
      setError(result.error || 'Failed to submit vote. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const updatePlayerScoreInDB = async (points: number, isCorrect: boolean, responseTimeMs: number) => {
    if (!currentPlayerId) return;
    console.log(`[${debugId}] 💾 Updating database: +${points} points, correct: ${isCorrect}`);
    
    try {
      const { data: playerData, error: fetchError } = await supabase
        .from('players')
        .select('score, stats')
        .eq('id', currentPlayerId)
        .single();
        
      if (fetchError) throw fetchError;
      
      const currentStats = playerData.stats || {
        totalPoints: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        averageResponseTimeMs: 0
      };
      
      const newTotalAnswers = currentStats.totalAnswers + 1;
      const newAverageResponseTime = currentStats.totalAnswers === 0
        ? responseTimeMs
        : Math.round((currentStats.averageResponseTimeMs * currentStats.totalAnswers + responseTimeMs) / newTotalAnswers);
      
      const newStats = {
        totalPoints: currentStats.totalPoints + points,
        correctAnswers: currentStats.correctAnswers + (isCorrect ? 1 : 0),
        totalAnswers: newTotalAnswers,
        averageResponseTimeMs: newAverageResponseTime
      };
      
      const { error: updateError } = await supabase
        .from('players')
        .update({ 
          score: playerData.score + points,
          stats: newStats
        })
        .eq('id', currentPlayerId);
        
      if (updateError) throw updateError;
      console.log(`[${debugId}] ✅ Database updated: score now ${playerData.score + points}`);
      
      setPlayerScore(playerData.score + points);
      updatePlayerScore(currentPlayerId, playerData.score + points);
      
    } catch (err: any) {
      console.error('Error updating player score:', err);
      setError('Failed to update score');
    }
  };

  // CRITICAL FIX: Watch for timer expiration to reveal results
  useEffect(() => {
    if ((timerState.hasExpired || timerExpired) && hasAnswered && !showResult && 
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
  }, [timerState.hasExpired, timerExpired, hasAnswered, showResult, isCorrect, pointsEarned, currentActivation, debugId, hasPendingReward, pendingPoints, pendingCorrect, pendingResponseTime]);

  // Original fetch and subscription logic (keeping existing logic)
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
    
    // Set up subscriptions
    const setupSubscriptions = async () => {
      if (!roomId) return;
      
      // Subscribe to game session changes
      const gameSessionChannel = supabase
        .channel(`game_session_${roomId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `room_id=eq.${roomId}`
        }, async (payload: any) => {
          console.log('Game session change:', payload);
          if (payload.new?.current_activation) {
            await fetchCurrentActivation(payload.new.current_activation);
          } else {
            setCurrentActivation(null);
            resetAnswerState();
          }
        })
        .subscribe();

      // Subscribe to activation updates for timer changes
      const activationChannel = supabase
        .channel(`activation_updates_${roomId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'activations',
          filter: `room_id=eq.${roomId}`
        }, async (payload: any) => {
          if (currentActivation && payload.new.id === currentActivation.id) {
            console.log('Current activation updated:', payload.new.id);
            
            // Update activation without resetting everything
            setCurrentActivation(prev => ({
              ...prev,
              ...payload.new
            }));
            
            // Update timer if timer_started_at changed
            if (payload.new.timer_started_at !== payload.old?.timer_started_at && 
                payload.new.time_limit && payload.new.timer_started_at) {
              setupTimer(payload.new as Activation);
            }
          }
        })
        .subscribe();
        
      // Subscribe to player score updates
      const playerChannel = supabase
        .channel(`player_${currentPlayerId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${currentPlayerId}`
        }, (payload: any) => {
          if (payload.new?.score !== undefined) {
            setPlayerScore(payload.new.score);
            updatePlayerScore(currentPlayerId, payload.new.score);
          }
        })
        .subscribe();
      
      return () => {
        gameSessionChannel.unsubscribe();
        activationChannel.unsubscribe();
        playerChannel.unsubscribe();
      };
    };
    
    const cleanup = setupSubscriptions();
    
    return () => {
      cleanup.then(fn => fn && fn());
      // Cleanup timer on unmount
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [roomId, currentPlayerId, navigate]);

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

  const fetchRoomAndActivation = async () => {
    try {
      console.log(`[${debugId}] Fetching room and activation data for room: ${roomId}`);
      setLoading(true);
      
      // Fetch room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
        
      if (roomError) throw roomError;
      console.log(`[${debugId}] Room data fetched:`, roomData.name);
      setRoom(roomData);
      
      // Fetch current player data
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', currentPlayerId)
        .single();
        
      if (playerError) throw playerError;
      console.log(`[${debugId}] Player data fetched:`, playerData.name);
      
      setPlayerScore(playerData.score || 0);
      addPlayer(playerData);
      
      // Fetch current activation
      const { data: sessionData } = await supabase
        .from('game_sessions')
        .select('current_activation')
        .eq('room_id', roomId)
        .single();
        
      if (sessionData?.current_activation) {
        console.log(`[${debugId}] Current activation found:`, sessionData.current_activation);
        await fetchCurrentActivation(sessionData.current_activation);
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load game data');
      setLoading(false);
    }
  };
  
  const fetchCurrentActivation = async (activationId: string) => {
    try {
      console.log(`[${debugId}] Fetching activation: ${activationId}`);
      // Use retry function for better error handling
      const { data, error } = await retry(async () => {
        return await supabase
          .from('activations')
          .select('*')
          .eq('id', activationId)
          .single();
      }, 3, 500);
        
      if (error) throw error;
      
      console.log(`[${debugId}] Activation fetched:`, {
        type: data.type,
        time_limit: data.time_limit,
        timer_started_at: data.timer_started_at,
        show_answers: data.show_answers
      });
      
      setCurrentActivation(data);
      resetAnswerState();
      
      // Setup timer
      setupTimer(data);
      
      // Start response timer for questions
      if ((data.type === 'multiple_choice' || data.type === 'text_answer') && !hasAnswered) {
        setResponseStartTime(Date.now());
      }
      
    } catch (err: any) {
      console.log(`[${debugId}] Error fetching activation:`, err.message || err);
      console.error('Error fetching activation:', err.message || err);
      
      // Check if it's a network error
      if (isNetworkError(err)) {
        setShowNetworkStatus(true);
        setError('Network connection issue. Please check your internet connection.');
      } else {
        setError(getFriendlyErrorMessage(err));
      }
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
  
  const renderMediaContent = () => {
    if (!currentActivation?.media_url || currentActivation.media_type === 'none') return null;
    
    return (
      <div className="flex justify-center items-center mb-6">
        {currentActivation.media_type === 'youtube' ? (
          <div className="w-full max-w-lg rounded-lg shadow-md overflow-hidden">
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
            className="max-h-64 rounded-lg shadow-md"
            fallbackText="Image not available"
          />
        )}
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-theme-gradient">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
          <p className="text-white text-xl">Loading game...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-theme-gradient p-4">
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
  
  // CRITICAL FIX: Enhanced timer visibility logic using both new and legacy states
  const shouldShowTimer = (timerState.isActive || hasActiveTimer) && 
                         (timerState.timeRemaining !== null || timeRemaining !== null) && 
                         (timerState.timeRemaining! >= 0 || timeRemaining! >= 0);
  
  // Use the most current time remaining value
  const currentTimeRemaining = timerState.timeRemaining !== null ? timerState.timeRemaining : timeRemaining;
  
  return (
    <div 
      className="min-h-screen p-4 relative"
      style={{ 
        background: `linear-gradient(to bottom right, ${roomTheme.primary_color}, ${roomTheme.secondary_color})` 
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
      
      {/* CRITICAL FIX: Enhanced mobile timer with maximum visibility */}
      {shouldShowTimer && isMobile && currentTimeRemaining !== null && (
        <div className="fixed top-4 left-4 right-4 z-[9999] flex justify-center pointer-events-none">
          <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl border-4 border-yellow-400 animate-pulse pointer-events-auto">
            <div className="flex items-center justify-center text-2xl font-bold">
              <Clock className="w-8 h-8 mr-3 text-yellow-300 flex-shrink-0" />
              <span className="text-3xl tabular-nums font-mono">
                {Math.floor(currentTimeRemaining / 60)}:{(currentTimeRemaining % 60).toString().padStart(2, '0')}
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
            {shouldShowTimer && !isMobile && currentTimeRemaining !== null && (
              <div className="flex items-center px-4 py-2 bg-red-500/20 backdrop-blur-sm rounded-full text-white font-mono border border-red-400/50">
                <Clock className="w-5 h-5 mr-2 text-red-300" />
                <span className="font-bold text-lg tabular-nums">
                  {Math.floor(currentTimeRemaining / 60)}:{(currentTimeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
            
            {/* POLL TIMER */}
            {currentActivation?.type === 'poll' && currentActivation.time_limit && currentActivation.timer_started_at && (
              <div className="flex items-center px-3 py-2 bg-yellow-500/20 backdrop-blur-sm rounded-full text-white font-mono text-sm border border-yellow-500/30">
                <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                <CountdownTimer 
                  initialSeconds={currentActivation.time_limit}
                  startTime={currentActivation.timer_started_at}
                  variant="small"
                  showIcon={false}
                  showProgressBar={false}
                  className="text-yellow-200"
                />
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
            {currentActivation.type === 'leaderboard' ? (
              <LeaderboardDisplay 
                roomId={roomId!}
                maxPlayers={20}
                autoRefresh={true}
                refreshInterval={5000}
                showStats={true}
              />
            ) : (
              <>
                <h2 className="text-xl sm:text-2xl font-semibold text-white mb-6 text-center">
                  {currentActivation.question}
                </h2>
                
                {renderMediaContent()}
                
                {/* Multiple Choice */}
                {currentActivation.type === 'multiple_choice' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {currentActivation.options?.map((option, index) => {
                      const isSelected = option.text === selectedAnswer;
                      const isCorrectAnswer = option.text === currentActivation.correct_answer;
                      // BULLETPROOF: Only show correct/incorrect if canRevealResults() returns true
                      const showCorrect = hasAnswered && canRevealResults() && isCorrectAnswer;
                      const showIncorrect = hasAnswered && canRevealResults() && isSelected && !isCorrectAnswer;
                      
                      return (
                        <button
                          key={index}
                          onClick={() => handleMultipleChoiceAnswer(option.text, option.id)}
                          disabled={hasAnswered}
                          className={`p-3 sm:p-4 rounded-lg transition transform hover:scale-105 ${
                            hasAnswered
                              ? showCorrect
                                ? 'bg-green-400/30 ring-2 ring-green-400'
                                : showIncorrect
                                  ? 'bg-red-400/30 ring-2 ring-red-400'
                                  : isSelected
                                    ? 'bg-blue-400/30 ring-2 ring-blue-400'
                                    : 'bg-white/20 opacity-50'
                              : 'bg-white/20 hover:bg-white/30 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {option.media_type !== 'none' && option.media_url && (
                              <MediaDisplay
                                url={option.media_url}
                                type={option.media_type}
                                alt={option.text}
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
                                fallbackText="!"
                              />
                            )}
                            <span className="text-white font-medium text-base sm:text-lg text-left">{option.text}</span>
                          </div>
                          
                          {showCorrect && (
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 mt-2" />
                          )}
                          {showIncorrect && (
                            <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 mt-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {/* Text Answer */}
                {currentActivation.type === 'text_answer' && (
                  <form onSubmit={handleTextAnswerSubmit} className="space-y-4">
                    <input
                      type="text"
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      disabled={hasAnswered}
                      className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 text-base"
                    />
                    
                    {!hasAnswered && (
                      <button
                        type="submit"
                        disabled={!textAnswer.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition disabled:opacity-50"
                      >
                        <Send className="w-5 h-5" />
                        Submit Answer
                      </button>
                    )}
                    
                    {/* BULLETPROOF: Only show results if canRevealResults() returns true */}
                    {showResult && canRevealResults() && (
                      <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-400/30' : 'bg-red-400/30'}`}>
                        <div className="flex items-center gap-2 text-white">
                          {isCorrect ? (
                            <>
                              <CheckCircle className="w-6 h-6" />
                              <span className="font-semibold">Correct!</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-6 h-6" />
                              <span className="font-semibold">Incorrect</span>
                            </>
                          )}
                        </div>
                        {!isCorrect && (
                          <p className="text-white/80 mt-2">
                            The correct answer was: <span className="font-medium">{currentActivation.exact_answer}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </form>
                )}
                
                {/* Poll */}
                {currentActivation.type === 'poll' && (
                  <div>
                    {pollState === 'pending' ? (
                      <div className="text-center text-white py-8">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-xl">Waiting for voting to start...</p>
                      </div>
                    ) : pollState === 'voting' && !pollVoted ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {currentActivation.options?.map((option, index) => (
                          <button
                            key={index}
                            onClick={() => handlePollVote(option.text, option.id)}
                            disabled={pollVoted || pollLoading}
                            className="p-3 sm:p-4 rounded-lg bg-white/20 hover:bg-white/30 transition transform hover:scale-105 disabled:opacity-50"
                          >
                            <div className="flex items-center gap-3">
                              {option.media_type !== 'none' && option.media_url && (
                                <img
                                  src={getStorageUrl(option.media_url)}
                                  alt={option.text}
                                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://via.placeholder.com/100?text=!';
                                  }}
                                />
                              )}
                              <span className="text-white font-medium text-base sm:text-lg text-left">{option.text}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <PollDisplay
                        options={currentActivation.options || []}
                        votes={pollVotes}
                        totalVotes={totalVotes}
                        displayType={currentActivation.poll_display_type || 'bar'}
                        pollState={pollState}
                        resultFormat={currentActivation.poll_result_format}
                        selectedAnswer={selectedAnswer}
                        selectedOptionId={selectedOptionId}
                        getStorageUrl={getStorageUrl}
                        themeColors={roomTheme}
                      />
                    )}
                  </div>
                )}
              </>
            )}
            </div>
          </ErrorBoundary>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-8 text-center">
            <Trophy className="w-16 h-16 text-white/50 mx-auto mb-4" />
            <p className="text-xl text-white">Waiting for the next question...</p>
          </div>
        )}
        
        {/* Point Animation - BULLETPROOF PROTECTION */}
        {showPointAnimation && canRevealResults() && showResult && pointsEarned > 0 && (
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
            <PointAnimation 
              points={pointsEarned} 
              className="text-3xl sm:text-4xl"
            />
          </div>
        )}
      </div>
      
      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs max-w-xs">
          <div>Timer Active: {(timerState.isActive || hasActiveTimer).toString()}</div>
          <div>Time Remaining: {currentTimeRemaining}</div>
          <div>Timer Expired: {(timerState.hasExpired || timerExpired).toString()}</div>
          <div>Show Timer: {shouldShowTimer.toString()}</div>
          <div>Mobile: {isMobile.toString()}</div>
          <div>Can Reveal: {canRevealResults().toString()}</div>
          <div>Has Answered: {hasAnswered.toString()}</div>
          <div>Show Result: {showResult.toString()}</div>
          <div>Pending Reward: {hasPendingReward.toString()}</div>
        </div>
      )}
    </div>
  );
}