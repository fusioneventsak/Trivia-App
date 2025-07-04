import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePollManager } from '../hooks/usePollManager';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore'; 
import { useTheme } from '../context/ThemeContext';
import { retry } from '../lib/error-handling';
import NetworkStatus from './ui/NetworkStatus';
import { AlertCircle, Loader2, Clock, RefreshCw } from 'lucide-react';
import MediaDisplay from './ui/MediaDisplay';
import PollVoteForm from './ui/PollVoteForm';
import { cn } from '../lib/utils';

const Game = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentPlayerId, getCurrentPlayer } = useGameStore();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentActivation, setCurrentActivation] = useState<any | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  
  // State for answer submission
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState<{
    isCorrect?: boolean;
    pointsAwarded?: number;
    message?: string;
  } | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  
  // Get current player
  const currentPlayer = getCurrentPlayer();
  
  // Load current activation for this room
  useEffect(() => {
    if (!roomId) return;
    
    // Set a timeout to prevent infinite loading state
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 10000); // 10 second timeout
    
    setLoadingTimeout(timeout);
    
    const loadGameSession = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get the current game session for this room with retry mechanism
        const { data: gameSession, error: sessionError } = await retry(
          () => supabase
            .from('game_sessions')
            .select('current_activation')
            .eq('room_id', roomId)
            .maybeSingle(),
          {
            maxAttempts: 3,
            delay: 1000,
            backoff: 'exponential'
          }
        );
          
        if (sessionError) {
          // If the error is not a "not found" error, log it
          if (sessionError.code !== 'PGRST116') {
            console.error('Error fetching game session:', sessionError);
            throw sessionError;
          } else {
            console.log('No game session found, showing waiting screen');
          }
          setCurrentActivation(null);
          setLoading(false);
          if (loadingTimeout) clearTimeout(loadingTimeout);
          return;
        }
        
        // If there's no current activation, show waiting screen
        if (!gameSession?.current_activation) {
          console.log('No current activation in game session');
          setCurrentActivation(null);
          setLoading(false); 
          if (loadingTimeout) clearTimeout(loadingTimeout);
          return;
        }
        
        console.log('Found current activation:', gameSession.current_activation);
        
        // Get the current activation details with retry mechanism
        try {
          const { data: activation, error: activationError } = await retry(
            () => supabase
              .from('activations')
              .select('*')
              .eq('id', gameSession.current_activation)
              .single(),
            {
              maxAttempts: 3,
              delay: 1000,
              backoff: 'exponential'
            }
          );
            
          if (activationError) {
            console.error('Error fetching activation:', activationError);
            throw activationError;
          }
          
          console.log('Activation loaded successfully:', activation);
          setCurrentActivation(activation);
        } catch (activationErr) {
          console.error('Exception fetching activation:', activationErr); 
          // Don't throw here, just set current activation to null
          setCurrentActivation(null);
        }

        setLoading(false);
        if (loadingTimeout) clearTimeout(loadingTimeout);
      } catch (err) {
        console.error('Error in loadCurrentActivation:', err);
        
        // Check if it's a network error
        if (!navigator.onLine || (err instanceof TypeError && err.message === 'Failed to fetch')) {
          setError('Network error. Please check your connection and try again.');
          setIsConnected(false);
        } else {
          setError('An unexpected error occurred');
        }
        
        setLoading(false);
        if (loadingTimeout) clearTimeout(loadingTimeout);
      }
    };
    
    // Load initial data
    loadGameSession();
    
    // Set up subscription for game session changes
    const gameSessionSubscription = supabase.channel(`game_session_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_sessions',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        // If a new activation was set or changed, reload the game session
        if (payload.new && (!payload.old || payload.new.current_activation !== payload.old.current_activation)) {
          loadGameSession();
        }
      })
      .subscribe();
      
    // Set up subscription for activation changes
    const activationSubscription = supabase.channel(`activations_${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'activations',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        // If the current activation was updated, refresh it
        if (payload.new && currentActivation && payload.new.id === currentActivation.id) {
          setCurrentActivation(prev => ({...prev, ...payload.new}));
        }
      })
      .subscribe();
    
    // Clean up subscriptions
    return () => {
      gameSessionSubscription.unsubscribe();
      activationSubscription.unsubscribe();
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  }, [roomId, currentActivation, retryCount, loadingTimeout]);
  
  // Reset state when activation changes
  useEffect(() => {
    // Reset answer and selection state when a new activation is loaded or cleared
    setSelectedAnswer(null);
    setAnswerText('');
    setAnswerSubmitted(false);
    setAnswerResult(null);
    setSubmittingAnswer(false);
  }, [currentActivation?.id]);
  
  // Check if player is in this room
  useEffect(() => {
    if (!roomId || !currentPlayerId) return;
    
    console.log('Checking if player is in room:', roomId, 'Player ID:', currentPlayerId);
    
    const checkPlayerInRoom = async () => {
      try {
        const { data, error } = await retry(
          () => supabase
            .from('players')
            .select('id, room_id')
            .eq('id', currentPlayerId)
            .single(),
          {
            maxAttempts: 3,
            delay: 1000,
            backoff: 'exponential'
          }
        );
          
        console.log('Player data:', data, 'Error:', error);
          
        if (error || !data) {
          // Player not found, redirect to join page
          navigate('/join', { 
            state: { 
              roomId, 
              message: 'Your player session has expired. Please rejoin the room.' 
            } 
          });
          return;
        }
        
        // If player is in a different room, redirect to join page
        if (data.room_id !== roomId) {
          navigate('/join', { 
            state: { 
              roomId, 
              message: 'You are currently in a different room. Please join this room to continue.' 
            } 
          });
        }
      } catch (err) {
        console.error('Error checking player room:', err);
      }
    };
    
    checkPlayerInRoom();
  }, [roomId, currentPlayerId, navigate]);
  
  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // If no player ID, redirect to join page
  if (!currentPlayerId) {
    console.log('No player ID, redirecting to join page');
    navigate('/join', { state: { roomId } });
    return null;
  }
  
  // Loading state
  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center" 
        style={{ background: `linear-gradient(to bottom right, ${theme.primary_color}, ${theme.secondary_color})` }}
      >
        <div className="text-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Loading Game</h2>
          <p className="opacity-80">Please wait while we set things up...</p>
          <button 
            onClick={() => setLoading(false)} 
            className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
          >
            Skip Loading
          </button>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{ 
          background: `linear-gradient(to bottom right, ${theme.primary_color}, ${theme.secondary_color})`,
          color: theme.text_color
        }}
      >
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p className="mb-6">{error}</p>
          
          {!isConnected && (
            <NetworkStatus onRetry={() => window.location.reload()} className="mb-6" />
          )}
          
          <button
            onClick={() => { setRetryCount(prev => prev + 1); setLoading(true); setError(null); }}
            className="px-4 py-2 bg-white/30 hover:bg-white/40 rounded-lg transition flex items-center justify-center mx-auto"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
  
  // Waiting for activation
  if (!currentActivation) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ 
          background: `linear-gradient(to bottom right, ${theme.primary_color}, ${theme.secondary_color})`,
          color: theme.text_color
        }}
      >
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4">Waiting for the next question...</h2>
          
          {currentPlayer && (
            <div className="mb-6">
              <div className="text-lg font-medium">
                Welcome, {currentPlayer.name}!
              </div>
              <div className="mt-2">
                Your score: {currentPlayer.score || 0} points
              </div>
            </div>
          )}
          
          <p className="mb-6">
            The host will start the next question soon. Please wait.
          </p>
          
          {!isConnected && (
            <div className="mb-6">
              <NetworkStatus onRetry={() => window.location.reload()} />
            </div>
          )}
          
          <button
            onClick={() => { setRetryCount(prev => prev + 1); setLoading(true); }}
            className="px-4 py-2 bg-white/30 hover:bg-white/40 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
    );
  }
  
  // Render the appropriate component based on activation type
  return (
    <div className="min-h-screen flex flex-col" style={{ 
      background: `linear-gradient(to bottom right, ${theme.primary_color}, ${theme.secondary_color})`,
      color: theme.text_color
    }}>
      {!isConnected && (
        <div className="p-4">
          <NetworkStatus onRetry={() => window.location.reload()} />
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 max-w-xl w-full">
          {/* Timer display if applicable */}
          {currentActivation.time_limit > 0 && currentActivation.timer_started_at && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center px-3 py-1 bg-white/30 rounded-full">
                <Clock className="w-4 h-4 mr-2" />
                <span>Time remaining: {Math.max(0, Math.floor(currentActivation.time_limit - (Date.now() - new Date(currentActivation.timer_started_at).getTime()) / 1000))}s</span>
              </div>
            </div>
          )}
          
          <h2 className="text-xl font-bold mb-4">{currentActivation?.question}</h2>
          
          {/* Display media if available */}
          {currentActivation?.media_type !== 'none' && currentActivation?.media_url && (
            <div className="mb-6 flex justify-center">
              <MediaDisplay
                url={currentActivation.media_url}
                type={currentActivation.media_type}
                alt="Question media"
                className={cn(
                  "rounded-lg max-h-64 object-contain",
                  currentActivation.media_type === 'youtube' && "w-full aspect-video"
                )}
              />
            </div>
          )}
          
          {/* Render different UI based on activation type */}
          {currentActivation?.type === 'poll' && (
            <div className="space-y-4">
              {/* Use the PollVoteForm component with usePollManager hook */}
              <PollVotingSection 
                activation={currentActivation}
                playerId={currentPlayerId}
                roomId={roomId}
                theme={theme}
              />
            </div>
          )}
          
          {currentActivation?.type === 'multiple_choice' && (
            <div className="space-y-4">
              {/* Answer result feedback */}
              {answerResult && (
                <div className={cn(
                  "p-4 rounded-lg mb-4",
                  answerResult.isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                )}>
                  <div className="font-medium">
                    {answerResult.isCorrect ? 'Correct!' : 'Incorrect'}
                  </div>
                  {answerResult.pointsAwarded !== undefined && (
                    <div>
                      {answerResult.isCorrect 
                        ? `You earned ${answerResult.pointsAwarded} points!` 
                        : 'No points awarded.'}
                    </div>
                  )}
                  {answerResult.message && (
                    <div>{answerResult.message}</div>
                  )}
                </div>
              )}
              
              {/* Options */}
              {!answerSubmitted && (
                <div className="space-y-3">
                  {currentActivation.options?.map((option: any, index: number) => (
                    <button
                      key={option.id || index}
                      onClick={() => {
                        setSelectedAnswer(option.text);
                        handleMultipleChoiceSubmit(option.text);
                      }}
                      disabled={answerSubmitted || submittingAnswer}
                      className={cn(
                        "w-full p-4 rounded-lg text-left transition",
                        selectedAnswer === option.text 
                          ? "bg-white/40 border-2 border-white" 
                          : "bg-white/20 hover:bg-white/30"
                      )}
                    >
                      <div className="flex items-center">
                        {/* Option letter */}
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold mr-3">
                          {String.fromCharCode(65 + index)}
                        </div>
                        
                        {/* Option media if available */}
                        {option.media_type !== 'none' && option.media_url && (
                          <div className="mr-3">
                            <MediaDisplay
                              url={option.media_url}
                              type={option.media_type}
                              alt={`Option ${String.fromCharCode(65 + index)}`}
                              className="w-10 h-10 object-cover rounded"
                            />
                          </div>
                        )}
                        
                        {/* Option text */}
                        <span>{option.text}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Show correct answer if timer expired or answer submitted */}
              {(answerSubmitted || currentActivation.show_answers) && currentActivation.correct_answer && (
                <div className="mt-4 p-4 bg-green-100 text-green-800 rounded-lg">
                  <div className="font-medium">Correct Answer:</div>
                  <div>{currentActivation.correct_answer}</div>
                </div>
              )}
            </div>
          )}
          
          {currentActivation?.type === 'text_answer' && (
            <div className="space-y-4">
              {/* Text input for answer */}
              {!answerSubmitted && (
                <div>
                  <input
                    type="text"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full p-3 rounded-lg bg-white/30 text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                    disabled={answerSubmitted || submittingAnswer}
                  />
                  <button
                    onClick={() => handleTextAnswerSubmit()}
                    disabled={!answerText.trim() || answerSubmitted || submittingAnswer}
                    className="mt-3 w-full p-3 bg-white/30 hover:bg-white/40 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingAnswer ? 'Submitting...' : 'Submit Answer'}
                  </button>
                </div>
              )}
              
              {/* Answer result feedback */}
              {answerResult && (
                <div className={cn(
                  "p-4 rounded-lg",
                  answerResult.isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                )}>
                  <div className="font-medium">
                    {answerResult.isCorrect ? 'Correct!' : 'Incorrect'}
                  </div>
                  {answerResult.pointsAwarded !== undefined && (
                    <div>
                      {answerResult.isCorrect 
                        ? `You earned ${answerResult.pointsAwarded} points!` 
                        : 'No points awarded.'}
                    </div>
                  )}
                </div>
              )}
              
              {/* Show correct answer if timer expired or answer submitted */}
              {(answerSubmitted || currentActivation.show_answers) && currentActivation.exact_answer && (
                <div className="mt-4 p-4 bg-green-100 text-green-800 rounded-lg">
                  <div className="font-medium">Correct Answer:</div>
                  <div>{currentActivation.exact_answer}</div>
                </div>
              )}
            </div>
          )}
          
          {/* Leaderboard display */}
          {currentActivation?.type === 'leaderboard' && (
            <div className="space-y-4">
              <p>Leaderboard would be displayed here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  
  // Function to handle multiple choice answer submission
  async function handleMultipleChoiceSubmit(answer: string) {
    if (!currentActivation || !currentPlayerId || answerSubmitted) return;
    
    try {
      setSubmittingAnswer(true);
      
      // Calculate time taken (if timer is active)
      let timeTakenMs = 0;
      if (currentActivation.timer_started_at) {
        const startTime = new Date(currentActivation.timer_started_at).getTime();
        timeTakenMs = Date.now() - startTime;
      }
      
      // Submit answer to backend with retry mechanism
      const { data, error } = await retry(
        () => supabase.functions.invoke('calculate-points', {
          body: {
            activationId: currentActivation.id,
            roomId,
            playerId: currentPlayerId,
            playerName: currentPlayer?.name,
            answer,
            timeTakenMs
          }
        }),
        {
          maxAttempts: 3,
          delay: 1000,
          backoff: 'exponential'
        }
      );
      
      if (error) throw error;
      
      // Update local state
      setAnswerSubmitted(true);
      setAnswerResult({
        isCorrect: data.isCorrect,
        pointsAwarded: data.pointsAwarded,
        message: data.message
      });
      
      // Update player score in store
      if (data.newScore !== undefined) {
        useGameStore.getState().updatePlayerScore(currentPlayerId, data.newScore);
      }
      
    } catch (error) {
      console.error('Error submitting answer:', error);
      setAnswerResult({
        isCorrect: false,
        message: 'Failed to submit answer. Please try again.'
      });
    } finally {
      setSubmittingAnswer(false);
    }
  }
  
  // Function to handle text answer submission
  async function handleTextAnswerSubmit() {
    if (!currentActivation || !currentPlayerId || !answerText.trim() || answerSubmitted) return;
    
    try {
      setSubmittingAnswer(true);
      
      // Calculate time taken (if timer is active)
      let timeTakenMs = 0;
      if (currentActivation.timer_started_at) {
        const startTime = new Date(currentActivation.timer_started_at).getTime();
        timeTakenMs = Date.now() - startTime;
      }
      
      // Submit answer to backend with retry mechanism
      const { data, error } = await retry(
        () => supabase.functions.invoke('calculate-points', {
          body: {
            activationId: currentActivation.id,
            roomId,
            playerId: currentPlayerId,
            playerName: currentPlayer?.name,
            answer: answerText.trim(),
            timeTakenMs
          }
        }),
        {
          maxAttempts: 3,
          delay: 1000,
          backoff: 'exponential'
        }
      );
      
      if (error) throw error;
      
      // Update local state
      setAnswerSubmitted(true);
      setAnswerResult({
        isCorrect: data.isCorrect,
        pointsAwarded: data.pointsAwarded,
        message: data.message
      });
      
      // Update player score in store
      if (data.newScore !== undefined) {
        useGameStore.getState().updatePlayerScore(currentPlayerId, data.newScore);
      }
      
    } catch (error) {
      console.error('Error submitting answer:', error);
      setAnswerResult({
        isCorrect: false,
        message: 'Failed to submit answer. Please try again.'
      });
    } finally {
      setSubmittingAnswer(false);
    }
  }
};

// Separate component for poll voting that uses the usePollManager hook
const PollVotingSection: React.FC<{
  activation: any;
  playerId: string | null;
  roomId: string | undefined;
  theme: any;
}> = ({ activation, playerId, roomId, theme }) => {
  // Use the poll manager hook properly
  const {
    hasVoted,
    selectedOptionId,
    pollState,
    submitVote
  } = usePollManager({
    activationId: activation.id,
    options: activation.options || [],
    playerId,
    roomId
  });
  
  return (
    <PollVoteForm
      key={activation.id}
      options={activation.options || []}
      onVote={async (optionId, optionText) => {
        try {
          const result = await submitVote(optionId);
          return result;
        } catch (error) {
          console.error('Error submitting vote:', error);
          return { success: false, error: 'Failed to submit vote' };
        }
      }}
      disabled={pollState !== 'voting'}
      themeColors={theme}
    />
  );
};

export default Game;