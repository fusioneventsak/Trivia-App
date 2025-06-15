import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';
import { Trophy, AlertCircle, ArrowRight, Loader2, WifiOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import CountdownTimer from './ui/CountdownTimer';
import PointsDisplay from './ui/PointsDisplay';

export default function PlayerEntry() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [room, setRoom] = useState<any>(null);
  const addPlayer = useGameStore((state) => state.addPlayer);
  const setCurrentPlayerId = useGameStore((state) => state.setCurrentPlayerId);
  const [savedPlayerId, setSavedPlayerId] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [playerRank, setPlayerRank] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [playerStats, setPlayerStats] = useState<any>(null);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  // Check for existing player data in localStorage
  useEffect(() => {
    const playerId = localStorage.getItem('currentPlayerId');
    if (playerId) {
      setSavedPlayerId(playerId);
      
      // Try to get player name and score if we have playerId
      const getPlayerInfo = async () => {
        if (!playerId) return;
        
        setRefreshingStats(true);
        const { data } = await supabase
          .from('players')
          .select('name, score, room_id, stats')
          .eq('id', playerId)
          .maybeSingle();
          
        if (data) {
          setName(data.name);
          setPlayerScore(data.score || 0);
          setPlayerStats(data.stats);
          
          // If we have a room_id, get player rank and total players
          if (data.room_id) {
            // Get all players in this room
            const { data: players } = await supabase
              .from('players')
              .select('id, score')
              .eq('room_id', data.room_id)
              .order('score', { ascending: false });
              
            if (players) {
              setTotalPlayers(players.length);
              
              // Find player rank
              const playerIndex = players.findIndex(p => p.id === playerId);
              if (playerIndex !== -1) {
                setPlayerRank(playerIndex + 1);
              }
            }
          }
        }
        setRefreshingStats(false);
      };
      
      getPlayerInfo();
      
      // Set up interval to refresh player stats every 5 seconds
      const intervalId = setInterval(getPlayerInfo, 5000);
      
      return () => {
        clearInterval(intervalId);
      };
    }
    
    // Check if room code and message were passed from Game component redirect
    const stateParams = location.state as { roomId?: string, message?: string } | null;
    if (stateParams?.roomId) {
      // Look up the room code from the room ID
      const fetchRoomCode = async () => {
        try {
          const { data, error } = await supabase
            .from('rooms')
            .select('room_code')
            .eq('id', stateParams.roomId)
            .single();
          
          if (!error && data?.room_code) {
            setRoomCode(data.room_code);
            validateRoomCode(data.room_code);
          }
        } catch (err) {
          console.error('Error fetching room code:', err);
        }
      };
      
      fetchRoomCode();
    }
    
    // Display message if provided (e.g. from redirect)
    if (stateParams?.message) {
      setMessage(stateParams.message);
    }

    // Check if room code was passed in the URL
    const searchParams = new URLSearchParams(location.search);
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      setRoomCode(codeFromUrl);
      validateRoomCode(codeFromUrl);
    }

    // Add network status event listeners
    const handleOnline = () => setNetworkError(false);
    const handleOffline = () => setNetworkError(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [location]);

  // Auto-validate room code as user types
  useEffect(() => {
    const validateRoomCode = async () => {
      if (roomCode.length !== 4) {
        setRoom(null);
        return;
      }

      setValidatingCode(true);
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', roomCode)
          .eq('is_active', true)
          .single();

        if (error) throw error;
        setRoom(data);
        setError('');
      } catch (err) {
        setRoom(null);
        setError('Invalid room code');
      } finally {
        setValidatingCode(false);
      }
    };

    const timeoutId = setTimeout(validateRoomCode, 500);
    return () => clearTimeout(timeoutId);
  }, [roomCode]);
  
  const validateRoomCode = async (code: string) => {
    if (code.length !== 4) {
      setRoom(null);
      return;
    }

    setValidatingCode(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
       .eq('room_code', code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error) throw error;
      setRoom(data);
      setError('');
    } catch (err) {
      setRoom(null);
      setError('Invalid room code');
    } finally {
      setValidatingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !roomCode || !room) {
      setError('Please enter your name and a valid room code');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Check network connection
      if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

      // Check room capacity
      const { count: playerCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id);

      if (playerCount && room.settings?.max_players && playerCount >= room.settings.max_players) {
        throw new Error('Room is full');
      }
      
      // If we have a saved player ID, check if they're already in this room
      if (savedPlayerId) {
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('*')
          .eq('id', savedPlayerId)
          .eq('room_id', room.id)
          .maybeSingle();
          
        if (existingPlayer) {
          // Player already exists in this room, just reuse their data
          addPlayer(existingPlayer);
          setCurrentPlayerId(existingPlayer.id);
          
          // Log analytics event
          await supabase.from('analytics_events').insert([{
            event_type: 'player_rejoin',
            room_id: room.id,
            event_data: {
              player_name: existingPlayer.name,
              player_id: existingPlayer.id
            }
          }]);

          // Navigate to game page
          navigate(`/game/${room.id}`);
          return;
        }
      }

      // Create new player with stats object
      const { data, error: dbError } = await supabase
        .from('players')
        .insert([{ 
          name, 
          room_id: room.id,
          score: 0,
          stats: {
            totalPoints: 0,
            correctAnswers: 0,
            totalAnswers: 0,
            averageResponseTimeMs: 0
          }
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      // Store player info
      addPlayer(data);
      setCurrentPlayerId(data.id);
      localStorage.setItem('currentPlayerId', data.id);

      // Log analytics event
      await supabase.from('analytics_events').insert([{
        event_type: 'player_join',
        room_id: room.id,
        event_data: {
          player_name: name,
          player_id: data.id
        }
      }]);

      // Navigate to game page
      navigate(`/game/${room.id}`);

    } catch (err: any) {
      console.error('Error joining room:', err);
      setError(err.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  // Format time in seconds to MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Calculate accuracy percentage
  const calculateAccuracy = (correct: number, total: number): string => {
    if (total === 0) return '0%';
    return `${Math.round((correct / total) * 100)}%`;
  };

  // Get room theme or use default theme
  const roomTheme = room?.theme || theme;

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-theme-gradient"
      style={{ 
        background: `linear-gradient(to bottom right, ${roomTheme.primary_color}, ${roomTheme.secondary_color})` 
      }}
    >
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          {room?.logo_url ? (
            <img 
              src={room.logo_url} 
              alt="Room Logo" 
              className="h-16 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                // Show fallback icon if image fails to load
                const container = e.currentTarget.parentElement;
                if (container) {
                  const fallbackDiv = document.createElement('div');
                  fallbackDiv.className = "p-3 rounded-full";
                  fallbackDiv.style.backgroundColor = `${roomTheme.primary_color}20`;
                  
                  const icon = document.createElement('div');
                  icon.className = "w-8 h-8 text-center flex items-center justify-center";
                  icon.style.color = roomTheme.primary_color;
                  icon.textContent = "🏆";
                  
                  fallbackDiv.appendChild(icon);
                  container.appendChild(fallbackDiv);
                }
              }}
            />
          ) : (
            <div 
              className="p-3 rounded-full"
              style={{ backgroundColor: `${roomTheme.primary_color}20` }}
            >
              <Trophy 
                className="w-8 h-8" 
                style={{ color: roomTheme.primary_color }}
              />
            </div>
          )}
        </div>

        <h1 
          className="text-3xl font-bold text-center mb-2"
          style={{ color: roomTheme.text_color }}
        >
          Join Room
        </h1>
        <p 
          className="text-center mb-8"
          style={{ color: `${roomTheme.text_color}99` }}
        >
          {room?.settings?.join_page_message || 'Enter your name and room code to join'}
        </p>

        {/* Display message if passed from redirect */}
        {message && (
          <div className="mb-6 p-4 bg-amber-100 text-amber-700 rounded-lg">
            {message}
          </div>
        )}

        {/* Player Stats (if returning player) */}
        {savedPlayerId && playerScore > 0 && (
          <div className="mb-6 p-4 bg-purple-50 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-medium text-purple-800">Welcome back!</h3>
                <p className="text-sm text-purple-600">Your current stats:</p>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end">
                  <PointsDisplay 
                    points={playerScore} 
                    className="text-purple-700 text-lg" 
                  />
                  {refreshingStats && (
                    <Loader2 className="w-3 h-3 ml-1 animate-spin text-purple-500" />
                  )}
                </div>
                {playerRank && (
                  <div className="text-sm text-purple-600">
                    Rank: {playerRank}/{totalPlayers}
                  </div>
                )}
              </div>
            </div>
            
            {/* Show detailed stats if available */}
            {playerStats && (
              <div className="mt-3 pt-3 border-t border-purple-100 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-purple-600">Correct Answers:</span>
                  <div className="font-medium">
                    {playerStats.correctAnswers}/{playerStats.totalAnswers} ({calculateAccuracy(playerStats.correctAnswers, playerStats.totalAnswers)})
                  </div>
                </div>
                <div>
                  <span className="text-purple-600">Avg. Response Time:</span>
                  <div className="font-medium">
                    {formatTime(playerStats.averageResponseTimeMs)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {networkError && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
            <WifiOff className="w-5 h-5 mr-2" />
            <span>No internet connection. Please check your network.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label 
              htmlFor="roomCode" 
              className="block text-sm font-medium mb-2"
              style={{ color: roomTheme.text_color }}
            >
              Room Code
            </label>
            <input
              type="text"
              id="roomCode"
              maxLength={4}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 rounded-lg border focus:ring-2 transition font-mono text-lg tracking-wider text-center uppercase"
              style={{ 
                borderColor: `${roomTheme.primary_color}40`,
                color: roomTheme.text_color,
                backgroundColor: 'white'
              }}
              placeholder="XXXX"
            />
            {validatingCode ? (
              <p 
                className="mt-2 text-sm flex items-center"
                style={{ color: `${roomTheme.text_color}80` }}
              >
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Validating code...
              </p>
            ) : room ? (
              <p 
                className="mt-2 text-sm flex items-center"
                style={{ color: roomTheme.primary_color }}
              >
                <ArrowRight className="w-4 h-4 mr-1" />
                Joining {room.name}
              </p>
            ) : roomCode && (
              <p 
                className="mt-2 text-sm flex items-center text-red-600"
              >
                <AlertCircle className="w-4 h-4 mr-1" />
                Invalid room code
              </p>
            )}
          </div>

          <div>
            <label 
              htmlFor="name" 
              className="block text-sm font-medium mb-2"
              style={{ color: roomTheme.text_color }}
            >
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border focus:ring-2 transition"
              style={{ 
                borderColor: `${roomTheme.primary_color}40`,
                color: roomTheme.text_color,
                backgroundColor: 'white'
              }}
              placeholder="Enter your name"
            />
          </div>

          {error && (
            <div 
              className="p-3 rounded-lg flex items-center"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
            >
              <AlertCircle className="w-5 h-5 mr-2 text-red-700" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !room || !name.trim() || networkError}
            className="w-full py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition duration-200"
            style={{ 
              backgroundColor: roomTheme.primary_color,
              color: 'white'
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <ArrowRight className="w-5 h-5" />
                Join Room
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}