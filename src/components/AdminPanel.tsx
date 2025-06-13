import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';
import HostControls from './host/HostControls';
import { Edit, Play, Pause, RefreshCw, Copy, CheckCircle, Lightbulb, BarChart4, Loader2, ExternalLink, Power, Trash, Users } from 'lucide-react';
import { useRoomStore } from '../store/roomStore';

export default function AdminPanel() {
  const navigate = useNavigate();
  const { id: roomId } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [mobileAccessCode, setMobileAccessCode] = useState<string | null>(null);
  const { isLiveMode, setLiveMode } = useGameStore();
  const { rooms, fetchRooms } = useRoomStore();
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [currentActivation, setCurrentActivation] = useState<string | null>(null);
  const [pollState, setPollState] = useState<'pending' | 'voting' | 'closed'>('pending');
  const [activeType, setActiveType] = useState<string | null>(null);
  const [isControllingPoll, setIsControllingPoll] = useState(false);
  
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
  
  // Check if we have a valid session
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          setUser(data.session.user);
        } else {
          // Redirect to login if not authenticated
          navigate('/login');
        }
      } catch (err) {
        console.error('Error checking session:', err);
        setError('Authentication error. Please try again.');
      }
    };
    
    checkUser();
  }, [navigate]);

  // Load initial data with timeout
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      if (!roomId) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Set a timeout to prevent infinite loading
        const timeout = setTimeout(() => {
          if (mounted) {
            setIsLoading(false);
            setError('Loading timed out. Please try refreshing.');
          }
        }, 10000); // 10 second timeout
        
        setLoadingTimeout(timeout);
        
        // Try to load from cache first
        try {
          const cachedPlayers = localStorage.getItem(`players_${roomId}`);
          if (cachedPlayers && mounted) {
            setPlayers(JSON.parse(cachedPlayers));
          }
        } catch (e) {
          console.error('Error reading cached players:', e);
        }
        
        // Fetch room data
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();
          
        if (roomError) throw roomError;
        if (mounted) {
          setRoom(roomData);
        }
        
        // Fetch fresh player data
        const { data, error: fetchError } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .order('score', { ascending: false });

        if (fetchError) throw fetchError;
        
        if (mounted) {
          setPlayers(data || []);
          
          // Cache the results
          try {
            localStorage.setItem(`players_${roomId}`, JSON.stringify(data));
          } catch (e) {
            console.error('Error caching players:', e);
          }
          
          clearTimeout(timeout);
          setLoadingTimeout(null);
          setIsLoading(false);
          setError(null);
        }
      } catch (err: any) {
        console.error('Error loading data:', err);
        if (mounted) {
          setError(err.message || 'Failed to load data');
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, [roomId]);

  // Memoized function to reset scores
  const resetScores = useCallback(async () => {
    if (!roomId) return;

    if (!window.confirm('Are you sure you want to reset all player scores to zero?')) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: dbError } = await supabase
        .from('players')
        .update({ score: 0 })
        .eq('room_id', roomId);

      if (dbError) throw dbError;

      // Update local state
      setPlayers(prev => prev.map(p => ({ ...p, score: 0 })));
      
      // Update cache
      try {
        localStorage.setItem(`players_${roomId}`, JSON.stringify(players.map(p => ({ ...p, score: 0 }))));
      } catch (e) {
        console.error('Error updating player cache:', e);
      }
      
      // Show success message
      setSuccessMessage('All player scores have been reset to zero');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Error resetting scores:', err);
      setError(err.message || 'Failed to reset scores');
    } finally {
      setIsLoading(false);
    }
  }, [roomId, players]);

  // Memoized function to remove player
  const removePlayer = useCallback(async (playerId: string) => {
    if (!roomId) return;
    
    try {
      setIsLoading(true);
      setError(null);

      const { error: dbError } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (dbError) throw dbError;

      // Update local state
      setPlayers(prev => prev.filter(p => p.id !== playerId));
      
      // Update cache
      try {
        localStorage.setItem(`players_${roomId}`, JSON.stringify(players.filter(p => p.id !== playerId)));
      } catch (e) {
        console.error('Error updating player cache:', e);
      }
    } catch (err: any) {
      console.error('Error removing player:', err);
      setError(err.message || 'Failed to remove player');
    } finally {
      setIsLoading(false);
    }
  }, [roomId, players]);

  // Memoized function to remove all players
  const removeAllPlayers = useCallback(async () => {
    if (!roomId) return;

    if (!window.confirm('Are you sure you want to remove ALL players? This cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { error: dbError } = await supabase
        .from('players')
        .delete()
        .eq('room_id', roomId);

      if (dbError) throw dbError;

      // Update local state
      setPlayers([]);
      
      // Update cache
      try {
        localStorage.setItem(`players_${roomId}`, JSON.stringify([]));
      } catch (e) {
        console.error('Error updating player cache:', e);
      }
      
      // Show success message
      setSuccessMessage('All players have been removed');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Error removing all players:', err);
      setError(err.message || 'Failed to remove players');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  const toggleLiveMode = useCallback(() => {
    setLiveMode(!isLiveMode);
  }, [isLiveMode, setLiveMode]);

  const generateMobileAccessCode = useCallback(async () => {
    if (!roomId || !user?.id) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Generate a random access code
      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Calculate expiration date (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      // Save to the host_controls table
      const { data, error: dbError } = await supabase
        .from('host_controls')
        .upsert({
          room_id: roomId,
          user_id: user.id,
          access_code: accessCode,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();
        
      if (dbError) throw dbError;
      
      setMobileAccessCode(accessCode);
    } catch (err: any) {
      console.error('Error generating access code:', err);
      setError(err.message || 'Failed to generate access code');
    } finally {
      setIsLoading(false);
    }
  }, [roomId, user]);

  const copyMobileAccessLink = useCallback(() => {
    if (!mobileAccessCode || !roomId) return;
    
    const link = `${window.location.origin}/mobile-control/${roomId}/${mobileAccessCode}`;
    navigator.clipboard.writeText(link);
    setCopySuccess('Link copied!');
    
    setTimeout(() => {
      setCopySuccess(null);
    }, 2000);
  }, [mobileAccessCode, roomId]);

  // If no roomId, show loading or redirect
  if (!roomId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
        <p className="ml-3 text-lg text-gray-700">Loading room...</p>
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
              <h1 className="text-2xl font-bold text-gray-800">Host Controls</h1>
              {room && (
                <p className="text-gray-600">
                  Room: {room.name}
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate(`/admin/room/${roomId}`)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                <Edit className="w-4 h-4" />
                Room Dashboard
              </button>
              
              <button
                onClick={toggleLiveMode}
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
                onClick={resetScores}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg font-medium hover:bg-yellow-200 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Reset All Scores
              </button>
              
              <button
                onClick={removeAllPlayers}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition disabled:opacity-50"
              >
                <Trash className="w-4 h-4" />
                Remove All Players
              </button>
            </div>
          </div>
          
          {successMessage && (
            <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span>{successMessage}</span>
            </div>
          )}
          
          <HostControls roomId={roomId} />
          
          {/* Mobile Controller Access */}
          <div className="mt-6 p-4 bg-purple-50 rounded-lg">
            <h2 className="text-lg font-semibold text-purple-800 mb-2">Mobile Controller</h2>
            <p className="text-sm text-purple-700 mb-4">
              Generate a temporary access code to control this room from your mobile device.
            </p>
            
            <div className="flex flex-col md:flex-row gap-3">
              {mobileAccessCode ? (
                <>
                  <div className="flex-1 p-3 bg-white border border-purple-200 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Access Link:</div>
                    <div className="text-sm text-gray-700 mb-1">
                      {`${window.location.origin}/mobile-control/${roomId}/${mobileAccessCode}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      Valid for 24 hours
                    </div>
                  </div>
                  
                  <button
                    onClick={copyMobileAccessLink}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    {copySuccess ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        {copySuccess}
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        Copy Link
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={generateMobileAccessCode}
                  disabled={isLoading}
                  className="w-full md:w-auto px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {isLoading ? 'Generating...' : 'Generate Mobile Access Code'}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Players List */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Players ({players.length})
            </h2>
            <button
              onClick={() => {
                setIsLoading(true);
                fetchRooms().finally(() => setIsLoading(false));
              }}
              disabled={isLoading}
              className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="Refresh player list"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          {players.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 mb-2">No players have joined yet.</p>
              <p className="text-sm text-gray-400">
                Players will appear here when they join the room.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
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
                  {players.map((player) => (
                    <tr key={player.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{player.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{player.score}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(player.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => removePlayer(player.id)}
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