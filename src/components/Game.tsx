// src/components/Game.tsx
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
    if (!currentActivation?.time_limit) {
      console.log(`[${debugId}] 🟢 No timer configured - can reveal results immediately`);
      return true;
    }
    
    // If timer has explicitly expired, can show
    if (timerState.hasExpired || timerExpired) {
      console.log(`[${debugId}] 🟢 Timer expired - can reveal results now`);
      return true;
    }
    
    // If timer hasn't started yet, can show
    if (!timerState.startedAt && !currentActivation?.timer_started_at) {
      console.log(`[${debugId}] 🟢 Timer not started - can reveal results immediately`);
      return true;
    }
    
    // Double-check timer expiration using server time
    if (currentActivation?.timer_started_at && currentActivation?.time_limit) {
      const startTime = new Date(currentActivation.timer_started_at).getTime();
      const currentTime = new Date().getTime();
      const elapsedMs = currentTime - startTime;
      const totalTimeMs = currentActivation.time_limit * 1000;
      
      if (elapsedMs >= totalTimeMs) {
        console.log(`[${debugId}] 🟢 Timer should have expired (server time check) - can reveal results`);
        // Update state to reflect expiration
        setTimerState(prev => ({ ...prev, hasExpired: true }));
        setTimerExpired(true);
        return true;
      }
    }
    
    // Check if time remaining is 0
    if (timerState.timeRemaining === 0 || timeRemaining === 0) {
      console.log(`[${debugId}] 🟢 Time remaining is 0 - can reveal results`);
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
            
            // Update legacy states IMMEDIATELY
            setTimeRemaining(0);
            setHasActiveTimer(false);
            setTimerExpired(true);
            setShowAnswers(true);
            
            // Trigger result reveal for answered questions
            if (hasAnswered) {
              setShowResult(true);
            }
            
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
    }
  };

  // Update player score in database
  const updatePlayerScoreInDB = async (points: number, isCorrect: boolean, responseTimeMs: number) => {
    if (!currentPlayerId || points <= 0) return;
    
    try {
      // Fetch current player data
      const { data: playerData, error: fetchError } = await supabase
        .from('players')
        .select('score, stats')
        .eq('id', currentPlayerId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Update stats
      const currentStats = playerData.stats || {
        totalPoints: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        averageResponseTimeMs: 0
      };
      
      const newTotalAnswers = currentStats.totalAnswers + 1;
      const newAverageResponseTime = currentStats.averageResponseTimeMs === 0
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

  // Setup room and initial data
  useEffect(() => {
    const setupRoom = async () => {
      if (!roomId) {
        navigate('/');
        return;
      }

      try {
        setLoading(true);
        setShowNetworkStatus(false);

        // Get room data with retry logic
        const roomResponse = await retry(async () => {
          return await supabase
            .from('rooms')
            .select('*')
            .eq('code', roomId)
            .single();
        }, 3);

        if (roomResponse.error) {
          if (isNetworkError(roomResponse.error)) {
            setShowNetworkStatus(true);
            setError('Connection issue. Please check your internet and try again.');
          } else if (roomResponse.error.code === 'PGRST116') {
            setError('Room not found. Please check the room code.');
            setTimeout(() => navigate('/'), 2000);
          } else {
            setError(getFriendlyErrorMessage(roomResponse.error));
          }
          return;
        }

        setRoom(roomResponse.data);

        // Check if player is already in this room
        const existingPlayerId = localStorage.getItem('currentPlayerId');
        if (existingPlayerId) {
          const { data: existingPlayer } = await supabase
            .from('players')
            .select('*')
            .eq('id', existingPlayerId)
            .eq('room_id', roomResponse.data.id)
            .maybeSingle();

          if (existingPlayer) {
            setCurrentPlayerId(existingPlayerId);
            addPlayer(existingPlayer);
            setPlayerScore(existingPlayer.score || 0);
            console.log(`[${debugId}] Found existing player:`, existingPlayer.name);
          }
        }

        // Get current game session
        const sessionResponse = await retry(async () => {
          return await supabase
            .from('game_sessions')
            .select('*, activations(*)')
            .eq('room_id', roomResponse.data.id)
            .eq('is_live', true)
            .maybeSingle();
        }, 3);

        if (sessionResponse.data?.activations) {
          handleActivationChange(sessionResponse.data.activations);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Error setting up room:', err);
        setError(getFriendlyErrorMessage(err));
        setLoading(false);
      }
    };

    setupRoom();
  }, [roomId, navigate, addPlayer, setCurrentPlayerId, debugId]);

  // Handle activation changes
  const handleActivationChange = (activation: Activation | null) => {
    console.log(`[${debugId}] 📋 Activation change:`, activation?.id);
    
    // Only reset if it's a different activation
    if (activation?.id !== lastActivationIdRef.current) {
      setCurrentActivation(activation);
      lastActivationIdRef.current = activation?.id || null;
      
      // Reset states for new activation
      if (activation) {
        setSelectedAnswer('');
        setSelectedOptionId('');
        setTextAnswer('');
        setHasAnswered(false);
        setShowResult(false);
        setIsCorrect(false);
        setPointsEarned(0);
        setShowPointAnimation(false);
        setResponseStartTime(Date.now());
        
        // Setup timer for new activation
        setupTimer(activation);
      }
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!room?.id) return;

    // Subscribe to game session changes
    const gameSessionChannel = supabase
      .channel(`game_session_${room.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_sessions',
        filter: `room_id=eq.${room.id}`
      }, async (payload: any) => {
        console.log(`[${debugId}] Game session update:`, payload);
        
        if (payload.new?.current_activation !== payload.old?.current_activation) {
          if (payload.new?.current_activation) {
            // Fetch the new activation
            const { data: activation } = await supabase
              .from('activations')
              .select('*')
              .eq('id', payload.new.current_activation)
              .single();
              
            if (activation) {
              handleActivationChange(activation);
            }
          } else {
            handleActivationChange(null);
          }
        }
      })
      .subscribe();

    // Subscribe to activation updates (for timer changes)
    const activationChannel = currentActivation?.id ? supabase
      .channel(`activation_${currentActivation.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'activations',
        filter: `id=eq.${currentActivation.id}`
      }, (payload: any) => {
        console.log(`[${debugId}] Activation update:`, payload);
        
        if (payload.new) {
          // Update timer if it just started
          if (!currentActivation.timer_started_at && payload.new.timer_started_at) {
            console.log(`[${debugId}] Timer just started!`);
            setupTimer(payload.new);
          }
          
          // Update poll state if changed
          if (payload.new.poll_state !== currentActivation.poll_state) {
            setCurrentActivation(prev => prev ? { ...prev, poll_state: payload.new.poll_state } : null);
          }
        }
      })
      .subscribe() : null;

    return () => {
      gameSessionChannel.unsubscribe();
      activationChannel?.unsubscribe();
    };
  }, [room?.id, currentActivation?.id, debugId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Compute display values
  const currentTimeRemaining = timerState.timeRemaining ?? timeRemaining;
  const shouldShowTimer = (timerState.isActive || hasActiveTimer) && 
                        currentTimeRemaining !== null && 
                        currentTimeRemaining > 0 &&
                        (currentActivation?.type === 'multiple_choice' || currentActivation?.type === 'text_answer');

  // Get room theme
  const roomTheme = room?.theme_colors || theme.colors;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: roomTheme.primary }}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-white mb-4 mx-auto" />
          <p className="text-white text-lg">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: roomTheme.primary }}>
        <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4 mx-auto" />
          <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
          <p className="text-white/80">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 w-full px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!currentPlayerId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: roomTheme.primary }}>
        <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <Trophy className="w-12 h-12 text-yellow-400 mb-4 mx-auto" />
          <h2 className="text-2xl font-bold text-white mb-4">Join the Game!</h2>
          <p className="text-white/80 mb-4">Please enter your name to join this room.</p>
          <button
            onClick={() => navigate(`/join/${roomId}`)}
            className="w-full px-4 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            <Users className="w-5 h-5" />
            Join Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col overflow-x-hidden"
      style={{ 
        backgroundColor: roomTheme.primary,
        background: `linear-gradient(135deg, ${roomTheme.primary} 0%, ${roomTheme.secondary} 100%)`
      }}
    >
      {showNetworkStatus && <NetworkStatus />}
      
      {/* MOBILE TIMER - CRITICAL FIX: Show at top on mobile */}
      {shouldShowTimer && isMobile && currentTimeRemaining !== null && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/90 backdrop-blur-sm text-white p-3 shadow-lg">
          <div className="flex items-center justify-center">
            <Clock className="w-5 h-5 mr-2" />
            <span className="font-mono font-bold text-lg tabular-nums">
              {Math.floor(currentTimeRemaining / 60)}:{(currentTimeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>
      )}
      
      <div className={`flex-1 p-4 max-w-4xl mx-auto w-full ${shouldShowTimer && isMobile ? 'mt-16' : ''}`}>
        {/* Header */}
        <div className={`mb-6 flex items-center justify-between ${shouldShowTimer && isMobile ? 'mt-2' : 'mt-4'}`}>
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
                  currentPlayerId={currentPlayerId}
                  playerScore={playerScore}
                />
              ) : (
                <>
                  {/* Question */}
                  <div className="mb-6">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">{currentActivation.question}</h2>
                    {currentActivation.media_url && (
                      <MediaDisplay
                        mediaType={currentActivation.media_type}
                        mediaUrl={getStorageUrl(currentActivation.media_url)}
                        className="mb-4"
                      />
                    )}
                  </div>

                  {/* Answer Status */}
                  {hasAnswered && showResult && canRevealResults() && (currentActivation.type === 'multiple_choice' || currentActivation.type === 'text_answer') && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center ${
                      isCorrect ? 'bg-green-500/20 border border-green-400/50' : 'bg-red-500/20 border border-red-400/50'
                    }`}>
                      {isCorrect ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-400 mr-3" />
                          <div className="flex-1">
                            <p className="text-green-400 font-semibold">Correct!</p>
                            {pointsEarned > 0 && (
                              <p className="text-green-300 text-sm">+{pointsEarned} points</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-6 h-6 text-red-400 mr-3" />
                          <div className="flex-1">
                            <p className="text-red-400 font-semibold">Incorrect</p>
                            {currentActivation.type === 'text_answer' && currentActivation.exact_answer && showAnswers && (
                              <p className="text-red-300 text-sm">
                                Correct answer: {currentActivation.exact_answer}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Answer Options */}
                  {currentActivation.type === 'multiple_choice' && (
                    <div className="space-y-3">
                      {currentActivation.options?.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleMultipleChoiceAnswer(option.text, option.id)}
                          disabled={hasAnswered || pollState === 'closed'}
                          className={`w-full p-4 rounded-lg text-left transition-all ${
                            hasAnswered
                              ? selectedAnswer === option.text
                                ? showResult && canRevealResults()
                                  ? isCorrect
                                    ? 'bg-green-500/30 border-2 border-green-400'
                                    : 'bg-red-500/30 border-2 border-red-400'
                                  : 'bg-white/20 border-2 border-white/40'
                                : showResult && showAnswers && canRevealResults() && option.text === currentActivation.correct_answer
                                  ? 'bg-green-500/20 border-2 border-green-400/50'
                                  : 'bg-white/10 opacity-50'
                              : 'bg-white/10 hover:bg-white/20 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {option.media_url && (
                              <img 
                                src={getStorageUrl(option.media_url)}
                                alt=""
                                className="w-12 h-12 object-cover rounded"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <span className="text-white font-medium text-base sm:text-lg">{option.text}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Text Answer */}
                  {currentActivation.type === 'text_answer' && (
                    <form onSubmit={handleTextAnswerSubmit} className="space-y-4">
                      <input
                        type="text"
                        value={textAnswer}
                        onChange={(e) => setTextAnswer(e.target.value)}
                        disabled={hasAnswered}
                        placeholder="Type your answer..."
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                      />
                      <button
                        type="submit"
                        disabled={hasAnswered || !textAnswer.trim()}
                        className={`w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                          hasAnswered
                            ? 'bg-white/10 text-white/50 cursor-not-allowed'
                            : 'bg-white text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <Send className="w-5 h-5" />
                        Submit Answer
                      </button>
                    </form>
                  )}

                  {/* Poll Options */}
                  {currentActivation.type === 'poll' && (
                    <div className="space-y-3">
                      {pollState === 'voting' ? (
                        currentActivation.options?.map((option, index) => (
                          <button
                            key={index}
                            onClick={() => handlePollVote(option.text, option.id)}
                            disabled={pollVoted || pollLoading}
                            className={`w-full p-4 rounded-lg text-left transition-all ${
                              pollVoted
                                ? selectedAnswer === option.text
                                  ? 'bg-blue-500/30 border-2 border-blue-400'
                                  : 'bg-white/10 opacity-50'
                                : 'bg-white/10 hover:bg-white/20 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {option.media_url && (
                                <img 
                                  src={getStorageUrl(option.media_url)}
                                  alt=""
                                  className="w-12 h-12 object-cover rounded"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              )}
                              <span className="text-white font-medium text-base sm:text-lg text-left">{option.text}</span>
                            </div>
                          </button>
                        ))
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