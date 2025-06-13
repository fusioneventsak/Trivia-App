import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Play, PauseCircle, CheckCircle, EyeOff, RefreshCw, AlertCircle, Lock, BarChart4, Vote, Info, Clock, Check, List, X, Eye, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function MobileController() {
  const { roomId, accessCode } = useParams<{ roomId: string, accessCode: string }>();
  const navigate = useNavigate();
  const [activations, setActivations] = useState<any[]>([]);
  const [currentActivation, setCurrentActivation] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollState, setPollState] = useState<'pending' | 'voting' | 'closed'>('pending');
  const [activeType, setActiveType] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isControllingPoll, setIsControllingPoll] = useState(false);
  const [refreshingActivations, setRefreshingActivations] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Verify access code
  useEffect(() => {
    if (!accessCode || !roomId) {
      setError('Invalid access information');
      return;
    }
    
    const verifyAccess = async () => {
      try {
        // First try to verify using room_code directly (for backward compatibility)
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('name, room_code')
          .eq('id', roomId)
          .single();
          
        if (!roomError && roomData && roomData.room_code === accessCode) {
          // Room code matches directly - this is a valid access method
          setRoomName(roomData.name);
          fetchActivations(roomId);
          return;
        }
        
        // If that fails, check if it's a host_controls access code
        const { data, error: accessError } = await supabase
          .from('host_controls')
          .select('id, room_id, expires_at')
          .eq('access_code', accessCode)
          .eq('room_id', roomId)
          .gt('expires_at', new Date().toISOString())
          .single();
          
        if (accessError || !data) {
          throw new Error('Invalid or expired access code');
        }
        
        // Get room name
        const { data: roomNameData, error: roomNameError } = await supabase
          .from('rooms')
          .select('name')
          .eq('id', data.room_id)
          .single();
          
        if (roomNameError) throw roomNameError;
        
        if (roomNameData) {
          setRoomName(roomNameData.name);
        }
        
        // Get the current activation for this room
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('current_activation')
          .eq('room_id', data.room_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (!sessionError && sessionData?.current_activation) {
          setCurrentActivation(sessionData.current_activation);
          
          // Get info about the current activation
          const { data: activationData, error: activationError } = await supabase
            .from('activations')
            .select('type, poll_state, parent_id')
            .eq('id', sessionData.current_activation)
            .single();
            
          if (!activationError && activationData) {
            setActiveType(activationData.type);
            
            if (activationData.type === 'poll') {
              setPollState(activationData.poll_state || 'pending');
            }
            
            if (activationData.parent_id) {
              // Find the template index
              const { data: templates } = await supabase
                .from('activations')
                .select('*')
                .eq('room_id', data.room_id)
                .eq('is_template', true)
                .order('created_at', { ascending: false });
                
              if (templates) {
                const index = templates.findIndex(t => t.id === activationData.parent_id);
                if (index !== -1) {
                  setCurrentIndex(index);
                }
              }
            }
          }
        }
        
        // Fetch available activations for this room
        fetchActivations(data.room_id);
      } catch (err: any) {
        console.error('Access verification error:', err);
        setError(err.message || 'Failed to verify access');
        setLoading(false);
      }
    };
    
    verifyAccess();
  }, [accessCode, roomId]);
  
  const fetchActivations = async (room_id: string) => {
    if (!room_id) return;
    
    try {
      setRefreshingActivations(true);
      
      // Get template activations for this room
      const { data: templates, error: templateError } = await supabase
        .from('activations')
        .select('*')
        .eq('room_id', room_id)
        .eq('is_template', true)
        .order('created_at', { ascending: false });
        
      if (templateError) throw templateError;
      
      setActivations(templates || []);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching activations:', error);
      setError(error.message || 'Failed to load activations');
      setLoading(false);
    } finally {
      setRefreshingActivations(false);
    }
  };
  
  // Set up real-time subscriptions for game state
  useEffect(() => {
    if (!roomId) return;
    
    const gameStateSubscription = supabase.channel(`mobile_game_state`)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public', 
        table: 'game_sessions',
        filter: `room_id=eq.${roomId}`
      }, async (payload) => {
        if (payload.new && payload.new.current_activation !== currentActivation) {
          setCurrentActivation(payload.new.current_activation);
          
          // Update activation info if we have a new activation
          if (payload.new.current_activation) {
            const { data, error } = await supabase
              .from('activations')
              .select('type, poll_state, parent_id')
              .eq('id', payload.new.current_activation)
              .single();
              
            if (!error && data) {
              setActiveType(data.type);
              
              if (data.type === 'poll') {
                setPollState(data.poll_state || 'pending');
              }
              
              // Update current index
              if (data.parent_id) {
                const index = activations.findIndex(t => t.id === data.parent_id);
                if (index !== -1) {
                  setCurrentIndex(index);
                }
              }
            }
          } else {
            setActiveType(null);
          }
        }
      })
      .subscribe();
      
    // Listen for poll state changes
    const pollStateSubscription = supabase.channel(`mobile_poll_state`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'activations',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        if (payload.new && payload.new.id === currentActivation && 
            payload.new.poll_state !== pollState) {
          setPollState(payload.new.poll_state);
        }
      })
      .subscribe();
      
    return () => {
      gameStateSubscription.unsubscribe();
      pollStateSubscription.unsubscribe();
    };
  }, [roomId, currentActivation, pollState, activations]);
  
  const activateNext = async () => {
    if (activations.length === 0) return;
    
    const nextIndex = currentIndex < activations.length - 1 ? currentIndex + 1 : 0;
    activateTemplate(activations[nextIndex]);
  };
  
  const activatePrevious = async () => {
    if (activations.length === 0) return;
    
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : activations.length - 1;
    activateTemplate(activations[prevIndex]);
  };
  
  const activateTemplate = async (template: any) => {
    if (!roomId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // First deactivate current activation
      if (currentActivation) {
        await clearCurrentActivation();
      }
      
      const activationData: any = {
        type: template.type,
        question: template.question || template.title,
        options: template.options,
        correct_answer: template.correct_answer,
        exact_answer: template.exact_answer,
        media_type: template.media_type,
        media_url: template.media_url,
        parent_id: template.id,
        is_template: false,
        room_id: roomId,
        poll_state: 'pending',
        poll_display_type: template.poll_display_type,
        poll_result_format: template.poll_result_format,
        option_colors: template.option_colors,
        title: template.title || template.question,
        description: template.description || '',
        time_limit: template.time_limit,
        show_answers: template.show_answers
      };
      
      // If timer is enabled, set timer_started_at for multiple choice and text answer
      if (template.time_limit && template.time_limit > 0 && 
          (template.type === 'multiple_choice' || template.type === 'text_answer')) {
        activationData.timer_started_at = new Date().toISOString();
      }
      
      // Create the activation
      const { data, error } = await supabase
        .from('activations')
        .insert([activationData])
        .select()
        .single();
      
      if (error) throw error;
      
      if (data) {
        // Update the game session with the new activation
        const { error: sessionError } = await supabase
          .from('game_sessions')
          .update({ current_activation: data.id })
          .eq('room_id', roomId);
          
        if (sessionError) throw sessionError;
        
        setCurrentActivation(data.id);
        setActiveType(data.type);
        
        if (data.type === 'poll') {
          setPollState('pending');
        }
        
        // Show success message
        setSuccessMessage('Template activated!');
        setTimeout(() => setSuccessMessage(null), 3000);
        
        // Close details modal if open
        setShowDetailsModal(false);
      }
    } catch (error: any) {
      console.error('Error activating template:', error);
      setError('Failed to activate template');
    } finally {
      setLoading(false);
    }
  };
  
  const clearCurrentActivation = async () => {
    if (!roomId) return;
    
    try {
      setLoading(true);
      
      // Update the game session to clear the current activation
      const { error } = await supabase
        .from('game_sessions')
        .update({ current_activation: null })
        .eq('room_id', roomId);
        
      if (error) throw error;
      
      setCurrentActivation(null);
      setActiveType(null);
      
      // Show success message
      setSuccessMessage('Template deactivated');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error clearing activation:', error);
      setError('Failed to clear activation');
    } finally {
      setLoading(false);
    }
  };
  
  const startPollVoting = async () => {
    if (!currentActivation) return;
    
    try {
      setIsControllingPoll(true);
      setError(null);
      
      console.log('Starting poll voting for activation:', currentActivation);
      
     // First, check the current state to avoid unnecessary updates
     const { data: currentState, error: stateError } = await supabase
       .from('activations')
       .select('poll_state')
       .eq('id', currentActivation)
       .single();
       
     if (stateError) throw stateError;
     
     // If already in the desired state, just update local state
     if (currentState?.poll_state === 'voting') {
       console.log('Poll is already in voting state');
       setPollState('voting');
       setSuccessMessage('Poll is already in voting state');
       setTimeout(() => setSuccessMessage(null), 3000);
       setIsControllingPoll(false);
       return;
     }
     
      // Update the poll state to voting
      const { error } = await supabase
        .from('activations')
        .update({ poll_state: 'voting' })
        .eq('id', currentActivation);
        
      if (error) throw error;
      
      setPollState('voting');
      
      // Also broadcast the state change through the poll channel
      const channel = supabase.channel(`poll-${currentActivation}`);
      await channel.subscribe();
      
      channel.send({
        type: 'broadcast',
        event: 'poll-state-change',
        payload: { state: 'voting' }
      });
      
      // Show success message
      setSuccessMessage('Voting started!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error starting poll voting:', error);
      setError('Failed to start voting');
    } finally {
      setIsControllingPoll(false);
    }
  };
  
  const lockPollVoting = async () => {
    if (!currentActivation) return;
    
    try {
      setIsControllingPoll(true);
      setError(null);
      
      // Update the poll state to closed
      const { error } = await supabase
        .from('activations')
        .update({ poll_state: 'closed' })
        .eq('id', currentActivation);
        
      if (error) throw error;
      
      setPollState('closed');
      
      // Also broadcast the state change through the poll channel
      const channel = supabase.channel(`poll-${currentActivation}`);
      await channel.subscribe();
      
      channel.send({
        type: 'broadcast',
        event: 'poll-state-change',
        payload: { state: 'closed' }
      });
      
      // Show success message
      setSuccessMessage('Voting closed!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error closing poll voting:', error);
      setError('Failed to close voting');
    } finally {
      setIsControllingPoll(false);
    }
  };
  
  // Start or control timer for any question type
  const manageTimer = async () => {
    if (!currentActivation) return;
    
    try {
      setLoading(true);
      
      // Fetch current activation details
      const { data: activation, error: fetchError } = await supabase
        .from('activations')
        .select('timer_started_at, time_limit, show_answers, type')
        .eq('id', currentActivation)
        .single();
      
      if (fetchError) throw fetchError;
      
      if (!activation) {
        throw new Error('Activation not found');
      }
      
      // If timer isn't started yet, start it
      if (!activation.timer_started_at && activation.time_limit) {
        // Start the timer
        const { error: updateError } = await supabase
          .from('activations')
          .update({ timer_started_at: new Date().toISOString() })
          .eq('id', currentActivation);
          
        if (updateError) throw updateError;
        
        setSuccessMessage('Timer started!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else if (activation.timer_started_at) {
        // Timer is already running - reveal answers immediately
        const { error: updateError } = await supabase
          .from('activations')
          .update({ show_answers: true })
          .eq('id', currentActivation);
          
        if (updateError) throw updateError;
        
        const actionType = activation.type === 'poll' ? 'Results' : 'Answers';
        setSuccessMessage(`${actionType} revealed!`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        // No timer set up for this activation
        setError('This activation does not have a timer configured');
      }
    } catch (error: any) {
      console.error('Error managing timer:', error);
      setError(error.message || 'Failed to manage timer');
    } finally {
      setLoading(false);
    }
  };
  
  const refreshActivations = async () => {
    await fetchActivations(roomId || '');
    
    // Get the current activation to update the poll state
    if (currentActivation) {
      try {
        const { data, error } = await supabase
          .from('activations')
          .select('type, poll_state')
          .eq('id', currentActivation)
          .single();
          
        if (!error && data) {
          setActiveType(data.type);
          if (data.type === 'poll') {
            setPollState(data.poll_state || 'pending');
          }
        }
      } catch (err) {
        console.error('Error refreshing current activation:', err);
      }
    }
  };
  
  // Open details modal
  const openDetailsModal = (template: any) => {
    setSelectedTemplate(template);
    setShowDetailsModal(true);
  };
  
  // Close details modal
  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedTemplate(null);
  };
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
        <div className="p-6 bg-white rounded-lg shadow-md w-full max-w-md">
          <h1 className="mb-4 text-xl font-bold text-red-600">Access Error</h1>
          <p className="mb-6 text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }
  
  if (loading && activations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
        <div className="w-16 h-16 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading controller...</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 p-4 bg-white shadow-md">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 truncate">
            {roomName || 'Room'} Controller
          </h1>
          
          {loading && <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />}
        </div>
      </header>
      
      {/* Success Message */}
      {successMessage && (
        <div className="mx-4 mt-4 p-3 bg-green-100 text-green-700 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          <span>{successMessage}</span>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>{error}</span>
        </div>
      )}
      
      {/* Current Activation */}
      <section className="p-4">
        <div className="p-4 bg-white rounded-lg shadow-sm">
          <h2 className="mb-2 text-base font-semibold text-gray-800">Current Status</h2>
          
          {currentActivation ? (
            <div className="p-3 bg-green-50 border border-green-100 rounded-md">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">
                  Active: {activeType === 'multiple_choice' ? 'Question' : activeType === 'poll' ? 'Poll' : activeType === 'leaderboard' ? 'Leaderboard' : 'Text Question'}
                </span>
              </div>
              
              {activeType === 'poll' && (
                <p className="mt-1 ml-7 text-sm text-green-600">
                  Poll state: {pollState === 'pending' ? 'Ready' : pollState === 'voting' ? 'Voting in progress' : 'Locked'}
                </p>
              )}
            </div>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-md">
              <div className="flex items-center gap-2 text-gray-500">
                <EyeOff className="w-5 h-5" />
                <span>No active question or poll</span>
              </div>
            </div>
          )}
        </div>
      </section>
      
      {/* Navigation Controls */}
      <section className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={activatePrevious}
            disabled={loading || activations.length === 0}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-sm disabled:opacity-50"
          >
            <ArrowLeft className="w-8 h-8 mb-1 text-purple-600" />
            <span className="text-sm text-gray-700">Previous</span>
          </button>
          
          <button
            onClick={clearCurrentActivation}
            disabled={loading || !currentActivation}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-sm disabled:opacity-50"
          >
            <EyeOff className="w-8 h-8 mb-1 text-gray-600" />
            <span className="text-sm text-gray-700">Clear</span>
          </button>
          
          <button
            onClick={activateNext}
            disabled={loading || activations.length === 0}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-sm disabled:opacity-50"
          >
            <ArrowRight className="w-8 h-8 mb-1 text-purple-600" />
            <span className="text-sm text-gray-700">Next</span>
          </button>
        </div>
      </section>
      
      {/* Poll Controls */}
      {activeType === 'poll' && currentActivation && (
        <section className="p-4">
          <h2 className="mb-2 text-base font-semibold text-gray-800 flex items-center">
            <Vote className="w-5 h-5 mr-2 text-purple-600" />
            Poll Controls
          </h2>
          
          <div className="bg-purple-50 p-4 rounded-lg shadow-sm mb-4">
            <div className="mb-2 text-purple-800 font-medium">Current Poll Status:</div>
            <div className={`inline-flex items-center px-3 py-1 rounded-full font-medium ${
              pollState === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
              pollState === 'voting' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {pollState === 'pending' ? 'Ready for Voting' : 
               pollState === 'voting' ? 'Voting in Progress' :
               'Voting Locked'}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {pollState === 'pending' && (
              <button
                onClick={startPollVoting}
                disabled={loading || isControllingPoll}
                className="flex flex-col items-center justify-center p-4 bg-green-600 text-white rounded-lg shadow-sm disabled:opacity-50"
              >
                <Play className="w-8 h-8 mb-1" />
                <span>{isControllingPoll ? 'Starting...' : 'Start Voting'}</span>
              </button>
            )}
            
            {pollState === 'voting' && (
              <button
                onClick={lockPollVoting}
                disabled={loading || isControllingPoll}
                className="flex flex-col items-center justify-center p-4 bg-amber-600 text-white rounded-lg shadow-sm disabled:opacity-50"
              >
                <Lock className="w-8 h-8 mb-1" />
                <span>{isControllingPoll ? 'Locking...' : 'Lock Voting'}</span>
              </button>
            )}
            
            {/* Show a "Voting Locked" state indicator */}
            {pollState === 'closed' && (
              <div className="flex flex-col items-center justify-center p-4 bg-gray-200 text-gray-700 rounded-lg shadow-sm">
                <Lock className="w-8 h-8 mb-1" />
                <span>Voting Locked</span>
              </div>
            )}
          </div>
        </section>
      )}
      
      {/* Timer Controls */}
      {(activeType === 'multiple_choice' || activeType === 'text_answer' || activeType === 'poll') && currentActivation && (
        <section className="p-4">
          <h2 className="mb-2 text-base font-semibold text-gray-800">Timer Controls</h2>
          
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={manageTimer}
              disabled={loading}
              className="flex flex-col items-center justify-center p-4 bg-blue-600 text-white rounded-lg shadow-sm disabled:opacity-50"
            >
              <Clock className="w-8 h-8 mb-1" />
              <span>{activeType === 'poll' ? 'Start Timer / Show Results' : 'Start Timer / Show Answers'}</span>
            </button>
          </div>
        </section>
      )}
      
      {/* Question List */}
      <section className="p-4 mb-20">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-base font-semibold text-gray-800">Available Questions</h2>
          <button 
            onClick={refreshActivations}
            disabled={refreshingActivations}
            className="p-2 text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50"
            title="Refresh questions"
          >
            <RefreshCw className={`w-4 h-4 ${refreshingActivations ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pb-4">
          {activations.map((activation, index) => (
            <div
              key={activation.id}
              className={`w-full p-3 rounded-lg transition ${
                currentIndex === index
                  ? 'bg-purple-100 border-2 border-purple-300'
                  : 'bg-white border border-gray-200'
              } ${loading ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center flex-1">
                  <div className="mr-3 flex-shrink-0">
                    {activation.type === 'multiple_choice' ? (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-700">Q</span>
                      </div>
                    ) : activation.type === 'poll' ? (
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-green-700">P</span>
                      </div>
                    ) : activation.type === 'leaderboard' ? (
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <span className="text-amber-700">L</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                        <span className="text-yellow-700">T</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {activation.title || activation.question}
                    </div>
                    <div className="text-xs text-gray-500">
                      {activation.type === 'multiple_choice' ? 'Multiple Choice' : 
                       activation.type === 'poll' ? 'Poll' : 
                       activation.type === 'leaderboard' ? 'Leaderboard' : 'Text Answer'}
                      {activation.time_limit > 0 && (
                        <span className="ml-2">({activation.time_limit}s timer)</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* View Details Button */}
                  <button
                    onClick={() => openDetailsModal(activation)}
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs flex items-center hover:bg-blue-200"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Details
                  </button>
                  
                  {/* Activate Button */}
                  <button
                    onClick={() => activateTemplate(activation)}
                    disabled={loading}
                    className="px-2 py-1 bg-purple-600 text-white rounded-md text-xs flex items-center hover:bg-purple-700 disabled:opacity-50"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Activate
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {activations.length === 0 && (
            <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
              No questions available in this room.
            </div>
          )}
        </div>
      </section>
      
      {/* Details Modal */}
      {showDetailsModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[85vh] overflow-auto">
            <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center z-10">
              <h3 className="text-lg font-bold">
                {selectedTemplate.type === 'multiple_choice' 
                  ? 'Multiple Choice Question' 
                  : selectedTemplate.type === 'text_answer' 
                    ? 'Text Answer Question'
                    : selectedTemplate.type === 'poll'
                      ? 'Poll Question'
                      : 'Leaderboard'}
              </h3>
              <button 
                onClick={closeDetailsModal}
                className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Title */}
              {selectedTemplate.title && selectedTemplate.title !== selectedTemplate.question && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-500">Title:</h4>
                  <p className="text-base">{selectedTemplate.title}</p>
                </div>
              )}
              
              {/* Question */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-500">Question:</h4>
                <p className="text-base font-medium">{selectedTemplate.question}</p>
              </div>
              
              {/* Media Preview (if available) */}
              {selectedTemplate.media_type !== 'none' && selectedTemplate.media_url && (
                <div className="mb-4 border p-2 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-500 mb-2">Media:</h4>
                  {selectedTemplate.media_type === 'image' || selectedTemplate.media_type === 'gif' ? (
                    <div className="flex justify-center">
                      <img 
                        src={selectedTemplate.media_url}
                        alt="Question media"
                        className="max-h-40 object-contain rounded"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Image+Error';
                        }}
                      />
                    </div>
                  ) : selectedTemplate.media_type === 'youtube' && (
                    <div className="text-sm text-blue-600">{selectedTemplate.media_url}</div>
                  )}
                </div>
              )}
              
              {/* Multiple Choice Options */}
              {selectedTemplate.type === 'multiple_choice' && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-500 mb-2">Options:</h4>
                  <div className="space-y-2">
                    {selectedTemplate.options?.map((option: any, idx: number) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border flex items-center ${
                          option.text === selectedTemplate.correct_answer 
                            ? 'bg-green-50 border-green-200' 
                            : 'border-gray-200'
                        }`}
                      >
                        <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm mr-3">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className={option.text === selectedTemplate.correct_answer ? 'font-medium' : ''}>
                          {option.text}
                        </span>
                        {option.text === selectedTemplate.correct_answer && (
                          <Check className="ml-auto w-5 h-5 text-green-500" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-green-50 rounded-lg text-green-700">
                    <span className="font-medium">Correct Answer:</span> {selectedTemplate.correct_answer}
                  </div>
                </div>
              )}
              
              {/* Text Answer */}
              {selectedTemplate.type === 'text_answer' && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-500 mb-2">Answer:</h4>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-green-700 font-medium">
                    {selectedTemplate.exact_answer}
                  </div>
                </div>
              )}
              
              {/* Poll Options */}
              {selectedTemplate.type === 'poll' && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-500 mb-2">Poll Options:</h4>
                  <div className="space-y-2">
                    {selectedTemplate.options?.map((option: any, idx: number) => (
                      <div 
                        key={idx} 
                        className="p-3 rounded-lg border border-gray-200 flex items-center"
                      >
                        <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm mr-3">
                          {idx + 1}
                        </span>
                        <span>{option.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Settings Information */}
              <div className="mt-6 border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-500 mb-2">Settings:</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedTemplate.time_limit > 0 && (
                    <div className="flex items-center p-2 bg-blue-50 rounded-lg">
                      <Clock className="w-4 h-4 mr-2 text-blue-600" />
                      <span>Timer: <strong>{selectedTemplate.time_limit}s</strong></span>
                    </div>
                  )}
                  
                  {selectedTemplate.difficulty && (
                    <div className={`flex items-center p-2 rounded-lg ${
                      selectedTemplate.difficulty === 'easy' 
                        ? 'bg-green-50 text-green-700' 
                        : selectedTemplate.difficulty === 'medium'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-red-50 text-red-700'
                    }`}>
                      <span>Difficulty: <strong>{selectedTemplate.difficulty}</strong></span>
                    </div>
                  )}
                  
                  {selectedTemplate.category && (
                    <div className="flex items-center p-2 bg-purple-50 text-purple-700 rounded-lg">
                      <span>Category: <strong>{selectedTemplate.category}</strong></span>
                    </div>
                  )}
                  
                  {selectedTemplate.type === 'poll' && selectedTemplate.poll_display_type && (
                    <div className="flex items-center p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                      <BarChart4 className="w-4 h-4 mr-2" />
                      <span>Display: <strong>{selectedTemplate.poll_display_type}</strong></span>
                    </div>
                  )}
                </div>
                
                {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-semibold text-gray-500 mb-2">Tags:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.tags.map((tag: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-gray-50 p-4 border-t flex justify-between items-center z-10">
              <button
                onClick={closeDetailsModal}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md"
              >
                Close
              </button>
              
              <button
                onClick={() => {
                  activateTemplate(selectedTemplate);
                  closeDetailsModal();
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center"
              >
                <Play className="w-4 h-4 mr-2" />
                Activate Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}