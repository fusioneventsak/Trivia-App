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
  const { currentPlayerId, setCurrentPlayerId, addPlayer, updatePlayerScore, getCurrentPlayer } = useGameStore();
  
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
    playerId: currentPlayerId,
    roomId: room?.id || null
  });

  // CRITICAL FIX: Enhanced result revelation logic - STRICT iPhone enforcement
  const canRevealResults = () => {
    // No timer at all? Can reveal immediately
    if (!currentActivation?.time_limit) {
      console.log(`[${debugId}] 🟢 No timer configured - can reveal results immediately`);
      return true;
    }
    
    // CRITICAL: Check if host has explicitly revealed answers
    if (currentActivation?.show_answers === true) {
      console.log(`[${debugId}] 🟢 Host has revealed answers - can show results`);
      return true;
    }
    
    // Has a timer and it has started? Can answer but not reveal results yet
    if (currentActivation?.time_limit && currentActivation?.timer_started_at) {
      console.log(`[${debugId}] 🟡 Timer started - can answer but not reveal results until host allows`);
      return false;
    }
    
    // Has a timer but not started? Cannot answer or reveal
    if (currentActivation?.time_limit && !currentActivation?.timer_started_at) {
      console.log(`[${debugId}] 🔴 Timer configured but not started - CANNOT reveal results`);
      return false;
    }
    
    // Default to NOT revealing if unsure (safer for iPhone)
    console.log(`[${debugId}] 🔴 Default denial - CANNOT reveal results`);
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

  // CRITICAL FIX: Enhanced timer setup with iOS-specific handling
  const setupTimer = (activation: Activation) => {
    console.log(`[${debugId}] 🔧 Setting up timer:`, {
      id: activation.id,
      time_limit: activation.time_limit,
      timer_started_at: activation.timer_started_at,
      show_answers: activation.show_answers,
      type: activation.type,
      isMobile,
      isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent)
    });
    
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Reset ALL states to ensure clean slate
    setTimerState({
      isActive: false,
      timeRemaining: null,
      hasExpired: false,
      startedAt: null,
      totalTime: null
    });
    
    // Legacy state resets
    setTimeRemaining(null);
    setHasActiveTimer(false);
    setTimerExpired(false);
    setShowAnswers(activation.show_answers === true); // Respect show_answers from host
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
    
    // If timer hasn't started yet, just show the time limit
    if (!activation.timer_started_at) {
      console.log(`[${debugId}] ⏳ Timer not started yet - waiting for host`);
      setTimerState({
        isActive: false,
        timeRemaining: activation.time_limit,
        hasExpired: false,
        startedAt: null,
        totalTime: activation.time_limit
      });
      setTimeRemaining(activation.time_limit);
      setHasActiveTimer(false);
      setTimerExpired(false);
      setShowAnswers(false); // Never show answers until timer starts
      return;
    }
    
    // Timer has started - check if answers should be shown
    if (activation.show_answers === true) {
      console.log(`[${debugId}] ✅ Host has revealed answers`);
      setTimerState({
        isActive: false,
        timeRemaining: 0,
        hasExpired: true,
        startedAt: activation.timer_started_at,
        totalTime: activation.time_limit
      });
      setTimeRemaining(0);
      setHasActiveTimer(false);
      setTimerExpired(true);
      setShowAnswers(true);
      return;
    }
    
    // Timer is running - calculate remaining time
    if (activation.timer_started_at) {
      const startTime = new Date(activation.timer_started_at).getTime();
      const currentTime = Date.now();
      const elapsedMs = currentTime - startTime;
      const totalTimeMs = activation.time_limit * 1000;
      
      console.log(`[${debugId}] ⏱️ Timer calculation:`, {
        startTime: new Date(activation.timer_started_at).toISOString(),
        currentTime: new Date(currentTime).toISOString(),
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
        setShowAnswers(activation.show_answers === true); // Only show answers if host has revealed them
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
      
      // CRITICAL: Use requestAnimationFrame for iOS compatibility
      let animationFrameId: number;
      let lastUpdateTime = Date.now();
      
      const updateTimer = () => {
        const now = Date.now();
        const deltaTime = now - lastUpdateTime;
        
        // Only update if at least 1 second has passed
        if (deltaTime >= 1000) {
          lastUpdateTime = now;
          
          setTimerState(prevState => {
            // Recalculate from server time for accuracy
            const currentTime = Date.now();
            const startTime = new Date(activation.timer_started_at!).getTime();
            const elapsedMs = currentTime - startTime;
            const totalTimeMs = activation.time_limit! * 1000;
            const remainingMs = Math.max(0, totalTimeMs - elapsedMs);
            const newTimeRemaining = Math.ceil(remainingMs / 1000);
            
            if (newTimeRemaining <= 0) {
              console.log(`[${debugId}] 🎯 TIMER COMPLETED (iOS)!!! Setting hasExpired = true`);
              
              // Update legacy states
              setTimeRemaining(0);
              setHasActiveTimer(false);
              setTimerExpired(true);
              setShowAnswers(activation.show_answers === true); // Only show answers if host has revealed them
              
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
        }
        
        // Continue animation loop if timer hasn't expired
        if (timerState.isActive || hasActiveTimer) {
          animationFrameId = requestAnimationFrame(updateTimer);
        }
      };
      
      // Start the animation loop
      animationFrameId = requestAnimationFrame(updateTimer);
      
      // Store cleanup function
      timerIntervalRef.current = {
        [Symbol.toPrimitive](): number {
          return animationFrameId;
        },
        ref: 'raf'
      } as any;
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
    if (hasAnswered || !currentActivation || !currentPlayerId) {
      console.log(`[${debugId}] 🛑 Cannot answer: hasAnswered=${hasAnswered}, currentActivation=${!!currentActivation}, currentPlayerId=${!!currentPlayerId}`);
      return;
    }
    
    // CRITICAL: Check if timer has started - can't answer until timer starts
    if (currentActivation.time_limit && !currentActivation.timer_started_at) {
      console.log(`[${debugId}] 🛑 Cannot answer: timer not started yet`);
      return;
    }
    
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
    if (hasAnswered || !currentActivation || !currentPlayerId || !textAnswer.trim()) {
      console.log(`[${debugId}] 🛑 Cannot submit text answer: hasAnswered=${hasAnswered}, currentActivation=${!!currentActivation}, currentPlayerId=${!!currentPlayerId}, textAnswer=${!!textAnswer.trim()}`);
      return;
    }
    
    // CRITICAL: Check if timer has started - can't answer until timer starts
    if (currentActivation.time_limit && !currentActivation.timer_started_at) {
      console.log(`[${debugId}] 🛑 Cannot submit text answer: timer not started yet`);
      return;
    }
    
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

  // CRITICAL FIX: Watch for timer expiration OR host reveal to show results
  useEffect(() => {
    // Only reveal results if host has set show_answers = true
    if (currentActivation?.show_answers === true && hasAnswered && !showResult && 
        (currentActivation?.type === 'multiple_choice' || currentActivation?.type === 'text_answer')) {
      console.log(`[${debugId}] 🎉 Host revealed answers - showing results and points!`);
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
  }, [currentActivation?.show_answers, hasAnswered, showResult, isCorrect, pointsEarned, currentActivation, debugId, hasPendingReward, pendingPoints, pendingCorrect, pendingResponseTime]);

  // Fetch room and player data
  const fetchRoomAndActivation = async () => {
    if (!roomId) {
      navigate('/');
      return;
    }

    try {
      setLoading(true);
      setShowNetworkStatus(false);

      // CRITICAL FIX: Check if roomId is a UUID or a room code
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);
      
      let roomResponse;
      if (isUuid) {
        console.log(`[${debugId}] Detected UUID format, querying by ID`);
        roomResponse = await retry(async () => {
          return await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single();
        }, 3);
      } else {
        console.log(`[${debugId}] Detected room code format, querying by room_code`);
        roomResponse = await retry(async () => {
          return await supabase
            .from('rooms')
            .select('*')
            .eq('room_code', roomId.toUpperCase())
            .single();
        }, 3);
      }

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

  // Setup room and initial data
  useEffect(() => {
    fetchRoomAndActivation();
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
            const { data: activation } = await