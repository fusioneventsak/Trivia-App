import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRoomStore } from '../../store/roomStore';
import { useGameStore } from '../../store/gameStore';
import { Settings, Users, Play, Pause, RefreshCw, AlertCircle, Edit, Share2, Copy, Check, Lightbulb, BarChart4, Loader2, ExternalLink, Power, Code, Lock, Trash, TabletSmartphone, LayoutDashboard, Vote, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import HostControls from '../host/HostControls';

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchRoom } = useRoomStore();
  const { isLiveMode, setLiveMode, currentActivation, setCurrentActivation } = useGameStore();
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<any[]>([]);
  const [activations, setActivations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingStage, setLoadingStage] = useState<string>('initializing');
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [showRoomCode, setShowRoomCode] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pollState, setPollState] = useState<'pending' | 'voting' | 'closed'>('pending');
  const [activeType, setActiveType] = useState<string | null>(null);
  const [isControllingPoll, setIsControllingPoll] = useState(false);
  const [activeTab, setActiveTab] = useState<'controls' | 'reset'>('controls');
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [resetInProgress, setResetInProgress] = useState(false);
  const [resetOption, setResetOption] = useState<'scores' | 'everything'>('scores');

  // Load room data
  useEffect(() => {
    if (id) {
      loadRoom();
    }
  }, [id]);

  // Subscribe to room updates
  useEffect(() => {
    if (!id) return;

    const subscription = supabase
      .channel('room_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${id}`
      }, (payload) => {
        if (payload.new) {
          setRoom(prev => ({
            ...prev,
            ...payload.new
          }));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);
  
  // Subscribe to activation updates for poll state changes
  useEffect(() => {
    if (!id || !currentActivation) return;

    const activationSubscription = supabase.channel(`activation_updates_${currentActivation}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'activations',
        filter: `id=eq.${currentActivation}`
      }, (payload) => {
        if (payload.new && payload.new.poll_state !== payload.old?.poll_state) {
          setPollState(payload.new.poll_state || 'pending');
        }
      })
      .subscribe();

    // Also fetch the current activation details
    const fetchActivationDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('activations')
          .select('poll_state, type')
          .eq('id', currentActivation)
          .single();
          
        if (error) throw error;
        
        if (data) {
          setActiveType(data.type);
          if (data.type === 'poll') {
            setPollState(data.poll_state || 'pending');
          }
        }
      } catch (err) {
        console.error('Error fetching activation details:', err);
      }
    };
    
    fetchActivationDetails();

    return () => {
      activationSubscription.unsubscribe();
    };
  }, [id, currentActivation]);

  const loadRoom = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const roomData = await fetchRoom(id);
      
      if (roomData) {
        setRoom(roomData);
        await Promise.all([
          fetchPlayers(id),
          fetchActivations(id)
        ]);
      }
    } catch (err: any) {
      console.error('Error loading room:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async (roomId: string) => {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('score', { ascending: false });
      
    setPlayers(data || []);
  };

  const fetchActivations = async (roomId: string) => {
    const { data } = await supabase
      .from('activations')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_template', true)
      .order('created_at', { ascending: false });
      
    setActivations(data || []);
  };

  const toggleGameMode = () => {
    setLiveMode(!isLiveMode);
  };

  const toggleRoomActive = async () => {
    if (!room || isTogglingActive) return;

    try {
      setIsTogglingActive(true);

      // Update room active status
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ 
          is_active: !room.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Log analytics event
      await supabase
        .from('analytics_events')
        .insert([{
          event_type: room.is_active ? 'room_deactivated' : 'room_activated',
          room_id: id,
          event_data: {
            previous_state: room.is_active,
            new_state: !room.is_active,
            timestamp: new Date().toISOString()
          }
        }]);

      // Update local state
      setRoom(prev => ({
        ...prev,
        is_active: !prev.is_active
      }));

    } catch (err: any) {
      console.error('Error toggling room active state:', err);
      setError('Failed to update room status');
    } finally {
      setIsTogglingActive(false);
    }
  };

  const resetRoom = async () => {
    if (!id) return;

    try {
      setResetInProgress(true);
      setError(null);
      
      if (resetOption === 'scores') {
        // Reset all player scores and stats to 0 but keep the players in the room
        const { error: updateError } = await supabase
          .from('players')
          .update({ 
            score: 0,
            stats: {
              totalPoints: 0,
              correctAnswers: 0,
              totalAnswers: 0,
              averageResponseTimeMs: 0
            }
          })
          .eq('room_id', id);
        
        if (updateError) throw updateError;
      } else if (resetOption === 'everything') {
        // Delete all players in this room
        const { error: deleteError } = await supabase
          .from('players')
          .delete()
          .eq('room_id', id);
        
        if (deleteError) throw deleteError;
      }
      
      // Clear current activation
      setCurrentActivation(null);
      
      // Update game session to clear current activation
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({ current_activation: null })
        .eq('room_id', id);
      
      if (sessionError) throw sessionError;
      
      // Refresh players list
      await fetchPlayers(id);
      
      // Show success message
      setSuccessMessage(
        resetOption === 'scores' 
          ? 'Room has been reset! All player scores have been reset to zero, but players remain in the room.'
          : 'Room has been completely reset! All players have been removed and leaderboard cleared.'
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      
      // Close the confirmation dialog
      setShowResetConfirmation(false);
      
    } catch (error: any) {
      console.error('Error resetting room:', error);
      setError(error.message);
    } finally {
      setResetInProgress(false);
    }
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}/results/${room.room_code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleRoomCode = () => {
    setShowRoomCode(!showRoomCode);
  };
  
  // Poll control functions
  const startPollVoting = async () => {
    if (!currentActivation) return;
    
    try {
      setIsControllingPoll(true);
      setError(null);
      
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
      setSuccessMessage('Voting locked!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error closing poll voting:', error);
      setError('Failed to close voting');
    } finally {
      setIsControllingPoll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
          <p className="text-gray-600">Loading room details...</p>
          <p className="text-gray-400 text-sm">{loadingStage}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>Room not found</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        {/* Room header with controls */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-800">{room.name}</h1>
                <button
                  onClick={toggleRoomActive}
                  disabled={isTogglingActive}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isTogglingActive ? 'bg-gray-100 text-gray-500' :
                    room.is_active 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  {isTogglingActive ? 'Updating...' : room.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
              <div className="flex items-center gap-3 mt-2">
                {showRoomCode && (
                  <div className="text-sm text-gray-500">
                    Room Code: <span className="font-mono font-bold">{room.room_code}</span>
                  </div>
                )}
                <button
                  onClick={toggleRoomCode}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Code className="w-4 h-4" />
                  {showRoomCode ? 'Hide Code' : 'Show Code'}
                </button>
                {showRoomCode && (
                  <Link 
                    to={`/results/${room.room_code}`}
                    className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                    target="_blank"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Results Page
                  </Link>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate(`/admin/rooms/edit/${id}`)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                <Edit className="w-4 h-4" />
                Edit Room
              </button>
              
              <button
                onClick={toggleGameMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                  isLiveMode
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isLiveMode ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isLiveMode ? 'Live Mode' : 'Practice Mode'}
              </button>
              
              <button
                onClick={copyRoomLink}
                className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition"
              >
                {copied ? (
                  <><Check className="w-4 h-4" /> Copied!</>
                ) : (
                  <><Share2 className="w-4 h-4" /> Share URL</>
                )}
              </button>
            </div>
          </div>
          
          {successMessage && (
            <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg flex items-center">
              <Check className="w-5 h-5 mr-2" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* HIGHLY VISIBLE ROOM CONTROLS */}
          <div className="mb-6 border-2 border-purple-500 rounded-lg shadow-md bg-white">
            <div className="bg-purple-600 text-white py-3 px-4 rounded-t-lg font-bold text-lg">
              Room Controls
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {/* Voting Controls Panel */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Vote className="w-5 h-5 mr-2 text-purple-600" />
                  Voting Controls
                </h2>
                
                {activeType === 'poll' && currentActivation ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-purple-50 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center">
                        <div className="bg-white p-2 rounded-md shadow-sm mr-3">
                          <BarChart4 className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">
                            Current Poll State: 
                          </div>
                          <div className={`font-bold text-lg capitalize ${
                            pollState === 'pending' ? 'text-yellow-600' :
                            pollState === 'voting' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {pollState}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        {pollState === 'pending' && (
                          <button
                            onClick={startPollVoting}
                            disabled={isControllingPoll}
                            className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold text-md shadow-sm"
                          >
                            <Play className="w-5 h-5" />
                            <span>{isControllingPoll ? 'Starting...' : 'Start Voting'}</span>
                          </button>
                        )}
                        
                        {pollState === 'voting' && (
                          <button
                            onClick={lockPollVoting}
                            disabled={isControllingPoll}
                            className="flex items-center gap-2 px-5 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-bold text-md shadow-sm"
                          >
                            <Lock className="w-5 h-5" />
                            <span>{isControllingPoll ? 'Locking...' : 'Lock Voting'}</span>
                          </button>
                        )}
                        
                        {pollState === 'closed' && (
                          <div className="flex items-center gap-2 px-5 py-3 bg-gray-600 text-white rounded-lg shadow-sm font-bold">
                            <Lock className="w-5 h-5" />
                            <span>Voting Locked</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700 border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="w-5 h-5" />
                        <span className="font-medium">Poll Control Instructions</span>
                      </div>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Pending:</strong> Initial state when poll is activated but voting hasn't started</li>
                        <li><strong>Voting:</strong> Participants can submit their votes</li>
                        <li><strong>Locked:</strong> Voting is closed and results are final</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 bg-gray-100 rounded-lg text-center text-gray-600 border border-gray-200">
                    <div className="font-medium">No active poll</div>
                    <p className="mt-1">Activate a poll template to enable voting controls</p>
                  </div>
                )}
              </div>
              
              {/* Room Reset Panel */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Trash className="w-5 h-5 mr-2 text-red-600" />
                  Room Reset
                </h2>
                
                <div className="space-y-4">
                  {!showResetConfirmation ? (
                    <button
                      onClick={() => setShowResetConfirmation(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-bold shadow-sm"
                    >
                      <RefreshCw className="w-5 h-5" />
                      <span>Reset Room</span>
                    </button>
                  ) : (
                    <>
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <span className="font-medium text-red-700">Warning: This action cannot be undone</span>
                        </div>
                        
                        <div className="mb-3">
                          <div className="mb-2 font-medium text-red-700">Choose reset option:</div>
                          
                          <div className="space-y-2">
                            <label className="flex items-start gap-2 p-2 border border-red-200 rounded-lg cursor-pointer bg-white">
                              <input 
                                type="radio" 
                                name="resetOption" 
                                value="scores" 
                                checked={resetOption === 'scores'} 
                                onChange={() => setResetOption('scores')}
                                className="mt-1"
                              />
                              <div>
                                <div className="font-medium text-gray-800">Reset Scores Only</div>
                                <div className="text-sm text-gray-600">Reset all player scores to zero but keep players in the room</div>
                              </div>
                            </label>
                            
                            <label className="flex items-start gap-2 p-2 border border-red-200 rounded-lg cursor-pointer bg-white">
                              <input 
                                type="radio" 
                                name="resetOption" 
                                value="everything" 
                                checked={resetOption === 'everything'} 
                                onChange={() => setResetOption('everything')}
                                className="mt-1"
                              />
                              <div>
                                <div className="font-medium text-gray-800">Complete Reset</div>
                                <div className="text-sm text-gray-600">Remove all players and clear the leaderboard entirely</div>
                              </div>
                            </label>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowResetConfirmation(false)}
                            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={resetRoom}
                            disabled={resetInProgress}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-bold"
                          >
                            {resetInProgress ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash className="w-4 h-4" />
                            )}
                            <span>Confirm Reset</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-700 border border-gray-200">
                    <p><strong>What gets reset:</strong></p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>All player scores will be set to zero</li>
                      <li>Player statistics (correct answers, response times, etc.)</li>
                      <li>Current active question/poll</li>
                    </ul>
                    <p className="mt-2"><strong>What remains:</strong></p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>Room settings and branding</li>
                      <li>Question templates</li>
                      <li>Room code</li>
                      <li>Player accounts (if "Reset Scores Only" is selected)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <HostControls roomId={id} />
        </div>

        {/* Room Stats */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Room Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Total Players</p>
                <p className="text-2xl font-bold text-purple-600">{players.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Activations</p>
                <p className="text-2xl font-bold text-purple-600">{activations.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-sm font-medium text-gray-700">
                  {new Date(room.created_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="text-sm font-medium text-gray-700">
                  {new Date(room.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Quick Links</h2>
            <div className="space-y-3">
              <Link
                to={`/admin/activations/${id}`}
                className="flex items-center px-4 py-2 text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                <span>Manage Activations</span>
              </Link>
              <Link
                to={`/admin/analytics/${id}`}
                className="flex items-center px-4 py-2 text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100"
              >
                <BarChart4 className="w-4 h-4 mr-2" />
                <span>View Analytics</span>
              </Link>
              <Link
                to={`/results/${room.room_code}`}
                target="_blank"
                className="flex items-center px-4 py-2 text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100"
              >
                <Users className="w-4 h-4 mr-2" />
                <span>Player View</span>
              </Link>
              <Link
                to={`/admin/branding/${id}`}
                className="flex items-center px-4 py-2 text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100"
              >
                <Settings className="w-4 h-4 mr-2" />
                <span>Room Branding</span>
              </Link>
            </div>
          </div>

          {/* Mobile Controls */}
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Mobile Controls</h2>
            <p className="mb-4 text-sm text-gray-600">
              Control this room from your mobile device for easier management during events.
            </p>
            <Link
              to={`/mobile-control/${id}/${room.room_code}`}
              target="_blank"
              className="block w-full px-4 py-2 text-center text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              Open Mobile Controls
            </Link>
          </div>
        </div>

        {/* Players List */}
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Players ({players.length})</h2>
            <button 
              onClick={() => fetchPlayers(id || '')}
              className="p-1 text-gray-400 hover:text-gray-700"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          
          {players.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No players have joined yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stats
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined At
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {players.map((player, index) => (
                    <tr key={player.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : index === 1 
                                ? 'bg-gray-200 text-gray-700'
                                : index === 2
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-600'
                          }`}>
                            {index + 1}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{player.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{player.score}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {player.stats ? (
                            <div className="text-xs">
                              <div>Correct: {player.stats.correctAnswers}/{player.stats.totalAnswers}</div>
                              <div>Avg Time: {(player.stats.averageResponseTimeMs / 1000).toFixed(1)}s</div>
                            </div>
                          ) : (
                            "No stats"
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(player.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to remove ${player.name}?`)) {
                              const { error } = await supabase
                                .from('players')
                                .delete()
                                .eq('id', player.id);
                              
                              if (error) {
                                console.error('Error removing player:', error);
                                setError('Failed to remove player');
                              } else {
                                // Refresh the player list
                                await fetchPlayers(id || '');
                              }
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}