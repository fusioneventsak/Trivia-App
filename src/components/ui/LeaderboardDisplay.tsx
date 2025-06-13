import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, Users, Clock } from 'lucide-react';
import { formatPoints } from '../../lib/point-calculator';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import LeaderboardItem from './LeaderboardItem';
import confetti from 'canvas-confetti';

interface LeaderboardDisplayProps {
  roomId: string;
  maxPlayers?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
  showStats?: boolean;
  containerStyle?: React.CSSProperties;
}

interface Player {
  id: string;
  name: string;
  score: number;
  stats?: {
    totalPoints: number;
    correctAnswers: number;
    totalAnswers: number;
    averageResponseTimeMs: number;
  };
}

const LeaderboardDisplay: React.FC<LeaderboardDisplayProps> = ({
  roomId,
  maxPlayers = 20,
  autoRefresh = true,
  refreshInterval = 10000, // 10 seconds
  className = '',
  showStats = true,
  containerStyle = {}
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [playerRankings, setPlayerRankings] = useState<{[key: string]: number}>({});
  const [previousRankings, setPreviousRankings] = useState<{[key: string]: number}>({});
  const { theme } = useTheme();
  const [debugMode, setDebugMode] = useState(false);
  
  // Toggle debug mode with key sequence
  useEffect(() => {
    const keys: string[] = [];
    const debugCode = ['d', 'e', 'b', 'u', 'g'];
    
    const keyHandler = (event: KeyboardEvent) => {
      keys.push(event.key.toLowerCase());
      if (keys.length > 5) keys.shift();
      
      if (keys.join('') === debugCode.join('')) {
        setDebugMode(prev => !prev);
        console.log('Debug mode:', !debugMode);
      }
    };
    
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('keydown', keyHandler);
    };
  }, [debugMode]);
  
  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    if (!roomId) {
      console.error("Cannot fetch leaderboard: roomId is missing");
      setError("Room ID is required to display leaderboard");
      setLoading(false);
      return;
    }

    try {
      setIsRefreshing(true);
      
      const { data, error } = await supabase
        .from('players')
        .select('id, name, score, stats, room_id')
        .eq('room_id', roomId)
        .order('score', { ascending: false });
          
      if (error) throw error;
      
      if (debugMode) {
        console.log('Fetched players data:', data);
      }
      
      // Save previous rankings before updating
      const prevRanks: {[key: string]: number} = {};
      players.forEach((player, index) => {
        prevRanks[player.id] = index + 1;
      });
      
      // Only update previous rankings if we have current rankings
      if (Object.keys(playerRankings).length > 0) {
        setPreviousRankings(playerRankings);
      }
      
      // Check if top player has changed
      const prevTopPlayer = players.length > 0 ? players[0] : null;
      const newTopPlayer = data?.length > 0 ? data[0] : null;
      
      // If we have a new top player and it's different from before, celebrate
      if (newTopPlayer && prevTopPlayer && 
          newTopPlayer.id !== prevTopPlayer.id && 
          newTopPlayer.score > prevTopPlayer.score) {
        // Fire confetti for new leader
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      
      // Update current rankings
      const newRanks: {[key: string]: number} = {};
      data?.forEach((player, index) => {
        newRanks[player.id] = index + 1;
      });
      setPlayerRankings(newRanks);
      
      setPlayers(data || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };
  
  // Set up real-time subscription to player changes
  useEffect(() => {
    // Initial fetch
    fetchLeaderboard();
    
    // Subscribe to player changes
    const subscription = supabase.channel(`players_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomId}`
      }, () => {
        fetchLeaderboard();
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to player changes for room ${roomId}`);
        }
        if (err) {
          console.error(`Error subscribing to player changes: ${err}`);
        }
      });
    
    // Set up auto-refresh if enabled
    let intervalId: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      intervalId = setInterval(fetchLeaderboard, refreshInterval);
    }
    
    // Return cleanup function
    return () => {
      subscription.unsubscribe();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [roomId, autoRefresh, refreshInterval, debugMode]);

  // Create filled array of defined size to handle placeholders
  const getDisplayPlayers = (): (Player | null)[] => {
    // Start with actual players
    const result = [...players];
    
    // Add null placeholders up to maxPlayers
    if (result.length < maxPlayers) {
      const placeholdersNeeded = maxPlayers - result.length;
      for (let i = 0; i < placeholdersNeeded; i++) {
        result.push(null);
      }
    } else {
      // If we have more players than max, just truncate
      return result.slice(0, maxPlayers);
    }
    
    return result;
  };

  // Always use two columns for better space usage
  const displayPlayers = getDisplayPlayers();
  const useTwoColumns = true;
  
  // Split players differently - 4 special slots then smaller slots
  // First column will have exactly 4 rows (top positions) plus 5 small ones = 9 total
  const firstColumnCount = 9;
  
  // Split players into columns
  const firstColumnPlayers = displayPlayers.slice(0, firstColumnCount);
  const secondColumnPlayers = displayPlayers.slice(firstColumnCount);
  
  if (loading && players.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-4 text-center">
        <RefreshCw className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
        <div className="text-white/70">Loading leaderboard...</div>
      </div>
    );
  }
  
  return (
    <div 
      className={`bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-4 ${className}`}
      style={{
        overflow: 'hidden',
        ...containerStyle
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Trophy className="w-5 h-5 text-yellow-300 mr-2" />
          <h2 className="text-lg font-semibold text-white">Leaderboard</h2>
          {players.length > 0 && (
            <div className="ml-2 bg-white/20 px-2 py-0.5 text-xs rounded-full text-white flex items-center">
              <Users className="w-3 h-3 mr-1" />
              {players.length}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchLeaderboard}
            disabled={isRefreshing}
            className="p-1 text-white/70 hover:text-white disabled:opacity-50"
            title="Refresh leaderboard"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {error ? (
        <div className="p-3 bg-red-400/20 text-white rounded-lg text-sm">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5">
          {/* First column */}
          <div className="space-y-0.5">
            {firstColumnPlayers.map((player, index) => {
              const isTopPosition = index < 4; // Only top 4 positions get special treatment
              
              return player ? (
                <LeaderboardItem
                  key={player.id}
                  player={player}
                  rank={index + 1}
                  previousRank={previousRankings[player.id]}
                  showStats={showStats && isTopPosition} // Only show stats for top positions
                />
              ) : (
                <div 
                  key={`empty-${index}`}
                  className={`flex items-center p-2 rounded-lg bg-white/5 ${isTopPosition ? "h-[38px]" : "h-[28px]"}`}
                >
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/30 text-xs mr-2">
                    {index + 1}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Second column */}
          {useTwoColumns && (
            <div className="space-y-0.5">
              {secondColumnPlayers.map((player, index) => (
                player ? (
                  <LeaderboardItem
                    key={player.id}
                    player={player}
                    rank={index + firstColumnCount + 1}
                    previousRank={previousRankings[player.id]}
                    showStats={false} // Never show stats for second column
                  />
                ) : (
                  <div 
                    key={`empty-2-${index}`}
                    className="flex items-center p-2 rounded-lg bg-white/5 h-[28px]"
                  >
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/30 text-xs mr-2">
                      {index + firstColumnCount + 1}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}
      
      {players.length > maxPlayers && (
        <div className="mt-2 text-center text-xs text-white/70">
          Showing top {maxPlayers} of {players.length} players
        </div>
      )}

      {players.length === 0 && !loading && (
        <div className="py-8 text-center text-white/60">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No players yet</p>
        </div>
      )}

      {debugMode && (
        <div className="mt-3 p-2 border border-white/20 rounded text-xs text-white/60 font-mono">
          <div>Players: {players.length}</div>
          <div>Last Update: {lastUpdated.toISOString()}</div>
          <div>Room ID: {roomId}</div>
          {players.length > 0 && (
            <pre className="overflow-auto max-h-32 text-[10px]">
              {JSON.stringify(players[0], null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default LeaderboardDisplay;