import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePollManager } from '../hooks/usePollManager';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';
import { useTheme } from '../context/ThemeContext';
import NetworkStatus from './ui/NetworkStatus';
import { AlertCircle, Loader2 } from 'lucide-react';

const Game = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentPlayerId, getCurrentPlayer } = useGameStore();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentActivation, setCurrentActivation] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  
  // Get current player
  const currentPlayer = getCurrentPlayer();
  
  // Load current activation for this room
  useEffect(() => {
    if (!roomId) return;
    
    const loadCurrentActivation = async () => {
      try {
        setLoading(true);
        
        // Get the current game session for this room
        const { data: gameSession, error: sessionError } = await supabase
          .from('game_sessions')
          .select('current_activation')
          .eq('room_id', roomId)
          .single();
          
        if (sessionError) {
          console.error('Error fetching game session:', sessionError);
          setError('Failed to load game session');
          setLoading(false);
          return;
        }
        
        // If there's no current activation, show waiting screen
        if (!gameSession?.current_activation) {
          setCurrentActivation(null);
          setLoading(false);
          return;
        }
        
        // Get the current activation details
        const { data: activation, error: activationError } = await supabase
          .from('activations')
          .select('*')
          .eq('id', gameSession.current_activation)
          .single();
          
        if (activationError) {
          console.error('Error fetching activation:', activationError);
          setError('Failed to load current question');
          setLoading(false);
          return;
        }
        
        setCurrentActivation(activation);
        setLoading(false);
      } catch (err) {
        console.error('Error in loadCurrentActivation:', err);
        setError('An unexpected error occurred');
        setLoading(false);
      }
    };
    
    loadCurrentActivation();
    
    // Set up subscription for game session changes
    const gameSessionSubscription = supabase.channel(`game_session_${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        // If current_activation changed, reload
        if (payload.new && payload.old && 
            payload.new.current_activation !== payload.old.current_activation) {
          loadCurrentActivation();
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
          setCurrentActivation(payload.new);
        }
      })
      .subscribe();
    
    // Clean up subscriptions
    return () => {
      gameSessionSubscription.unsubscribe();
      activationSubscription.unsubscribe();
    };
  }, [roomId, currentActivation]);
  
  // Check if player is in this room
  useEffect(() => {
    if (!roomId || !currentPlayerId) return;
    
    const checkPlayerInRoom = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('id, room_id')
          .eq('id', currentPlayerId)
          .single();
          
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
    navigate('/join', { state: { roomId } });
    return null;
  }
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Game</h2>
          <p className="text-gray-600">Please wait while we set things up...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">Something went wrong</h2>
          <p className="text-gray-600 mb-4 text-center">{error}</p>
          <div className="flex justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Reload Page
            </button>
          </div>
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
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white/30 hover:bg-white/40 rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }
  
  // Render the appropriate component based on activation type
  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ 
        background: `linear-gradient(to bottom right, ${theme.primary_color}, ${theme.secondary_color})`,
        color: theme.text_color
      }}
    >
      {!isConnected && (
        <div className="p-4">
          <NetworkStatus onRetry={() => window.location.reload()} />
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold mb-4">{currentActivation.question}</h2>
          
          {/* Render different UI based on activation type */}
          {currentActivation.type === 'poll' && (
            <div>
              <p>Poll component would go here</p>
            </div>
          )}
          
          {currentActivation.type === 'multiple_choice' && (
            <div>
              <p>Multiple choice component would go here</p>
            </div>
          )}
          
          {currentActivation.type === 'text_answer' && (
            <div>
              <p>Text answer component would go here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Game;