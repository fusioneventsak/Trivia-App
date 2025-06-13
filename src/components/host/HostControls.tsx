import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Play, Pause, Square, SkipForward, Eye, EyeOff, BarChart, Users, ChevronDown, ChevronUp, Unlock, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HostControlsProps {
  roomId: string;
  className?: string;
}

export default function HostControls({ roomId, className = '' }: HostControlsProps) {
  const [currentActivation, setCurrentActivation] = useState<any>(null);
  const [pollState, setPollState] = useState<'pending' | 'voting' | 'closed'>('pending');
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPollControls, setShowPollControls] = useState(false);
  
  useEffect(() => {
    fetchCurrentState();
    
    // Subscribe to changes
    const subscription = supabase.channel('host-controls')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_sessions',
        filter: `room_id=eq.${roomId}`
      }, () => {
        fetchCurrentState();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'activations',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        if (payload.new && payload.new.id === currentActivation?.id) {
          setCurrentActivation(payload.new);
          if (payload.new.poll_state) {
            setPollState(payload.new.poll_state);
          }
        }
      })
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [roomId]);
  
  const fetchCurrentState = async () => {
    try {
      // Get current game session
      const { data: session } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();
        
      if (session) {
        setIsLiveMode(session.is_live);
        
        if (session.current_activation) {
          // Get current activation details
          const { data: activation } = await supabase
            .from('activations')
            .select('*')
            .eq('id', session.current_activation)
            .single();
            
          if (activation) {
            setCurrentActivation(activation);
            if (activation.type === 'poll') {
              setPollState(activation.poll_state || 'pending');
              setShowPollControls(true);
            }
          }
        } else {
          setCurrentActivation(null);
          setShowPollControls(false);
        }
      }
    } catch (error) {
      console.error('Error fetching current state:', error);
    }
  };
  
  const deactivateCurrentActivation = async () => {
    if (!currentActivation) return;
    
    try {
      setLoading(true);
      
      // First, ensure we have a game session
      const { data: session } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();
      
      if (session) {
        // Update existing session to remove current activation
        const { error } = await supabase
          .from('game_sessions')
          .update({ 
            current_activation: null,
            is_live: isLiveMode 
          })
          .eq('id', session.id);
          
        if (error) throw error;
      } else {
        // Create new session with no activation
        const { error } = await supabase
          .from('game_sessions')
          .upsert([{
            room_id: roomId,
            current_activation: null,
            is_live: isLiveMode
          }], {
            onConflict: 'room_id'
          });
          
        if (error) throw error;
      }
      
      setCurrentActivation(null);
      setShowPollControls(false);
      setPollState('pending');
    } catch (error) {
      console.error('Error deactivating:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const updatePollState = async (newState: 'pending' | 'voting' | 'closed') => {
    if (!currentActivation || currentActivation.type !== 'poll') return;
    
    try {
      setLoading(true);
      
      console.log('Updating poll state to:', newState, 'for activation:', currentActivation.id);
      
      const { error } = await supabase
        .from('activations')
        .update({ poll_state: newState })
        .eq('id', currentActivation.id);
        
      if (error) throw error;
      
      setPollState(newState);
      setCurrentActivation({ ...currentActivation, poll_state: newState });
      
      // Also broadcast the state change through the poll channel
      const channel = supabase.channel(`poll-${currentActivation.id}`);
      await channel.subscribe();
      
      channel.send({
        type: 'broadcast',
        event: 'poll-state-change',
        payload: { state: newState }
      });
      
      // Show success message
      if (newState === 'voting') {
        console.log('Poll voting started successfully');
      } else if (newState === 'closed') {
        console.log('Poll voting closed successfully');
      }
      
    } catch (error: any) {
      console.error('Error updating poll state:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleLiveMode = async () => {
    try {
      setLoading(true);
      const newLiveMode = !isLiveMode;
      
      const { error } = await supabase
        .from('game_sessions')
        .update({ is_live: newLiveMode })
        .eq('room_id', roomId);
        
      if (error) throw error;
      
      setIsLiveMode(newLiveMode);
    } catch (error) {
      console.error('Error toggling live mode:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Live Mode Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${isLiveMode ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="font-medium text-gray-700">
            {isLiveMode ? 'Live Mode' : 'Practice Mode'}
          </span>
        </div>
        <button
          onClick={toggleLiveMode}
          disabled={loading}
          className={`px-3 py-1 rounded-md text-sm font-medium transition ${
            isLiveMode 
              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } disabled:opacity-50`}
        >
          {isLiveMode ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
      </div>
      
      {/* Current Activation Controls */}
      {currentActivation && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-medium text-gray-800 truncate">
                {currentActivation.question || currentActivation.title}
              </h3>
              <p className="text-sm text-gray-500">
                Type: {currentActivation.type.replace('_', ' ')}
              </p>
            </div>
            <button
              onClick={deactivateCurrentActivation}
              disabled={loading}
              className="px-3 py-1.5 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition disabled:opacity-50 flex items-center gap-1"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </div>
          
          {/* Poll-specific controls */}
          {currentActivation.type === 'poll' && (
            <div className="pt-3 border-t border-gray-200">
              <button
                onClick={() => setShowPollControls(!showPollControls)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-sm font-medium text-gray-700">Poll Controls</span>
                {showPollControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {showPollControls && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">Current State:</span>
                    <span className={`text-sm font-medium ${
                      pollState === 'voting' ? 'text-green-600' : 
                      pollState === 'closed' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {pollState === 'pending' ? 'Waiting' : 
                       pollState === 'voting' ? 'Voting Open' : 'Voting Closed'}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    {pollState === 'pending' && (
                      <button
                        onClick={() => updatePollState('voting')}
                        disabled={loading}
                        className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Unlock className="w-4 h-4" />
                        Start Voting
                      </button>
                    )}
                    
                    {pollState === 'voting' && (
                      <button
                        onClick={() => updatePollState('closed')}
                        disabled={loading}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Lock className="w-4 h-4" />
                        Close Voting
                      </button>
                    )}
                    
                    {pollState === 'closed' && (
                      <button
                        onClick={() => updatePollState('voting')}
                        disabled={loading}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Unlock className="w-4 h-4" />
                        Reopen Voting
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {!currentActivation && (
        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
          No activation is currently running
        </div>
      )}
    </div>
  );
}