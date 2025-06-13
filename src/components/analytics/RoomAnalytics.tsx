import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { BarChart4, Activity, Users, Clock, RefreshCw, Calendar, Filter, Trophy } from 'lucide-react';

interface RoomAnalyticsSummary {
  total_players: number;
  total_activations: number;
  total_answers: number;
  average_score: number;
  correct_answer_rate: number;
  recent_players: any[];
  top_players: any[];
  answer_history: any[];
}

export default function RoomAnalytics() {
  const { id: roomId } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<RoomAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d, all
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    if (!roomId) return;
    
    // Fetch room name
    const fetchRoomName = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('name')
        .eq('id', roomId)
        .single();
        
      if (data) {
        setRoomName(data.name);
      }
    };
    
    fetchRoomName();
    fetchAnalytics();
  }, [roomId, timeRange]);

  const fetchAnalytics = async () => {
    if (!roomId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get date for filtering
      const startDate = getStartDateForRange(timeRange);
      
      // Fetch summary data
      const summaryData = await fetchSummaryData(roomId, startDate);
      setSummary(summaryData);

    } catch (err: any) {
      console.error('Error fetching room analytics:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getStartDateForRange = (range: string): string => {
    const now = new Date();
    
    switch (range) {
      case '7d':
        now.setDate(now.getDate() - 7);
        break;
      case '30d':
        now.setDate(now.getDate() - 30);
        break;
      case '90d':
        now.setDate(now.getDate() - 90);
        break;
      case 'all':
        // Return an early date to get all data
        return '2000-01-01';
      default:
        now.setDate(now.getDate() - 7);
    }
    
    return now.toISOString();
  };

  const fetchSummaryData = async (roomId: string, startDate: string): Promise<RoomAnalyticsSummary> => {
    // Get total players
    const { count: totalPlayers, data: players } = await supabase
      .from('players')
      .select('*', { count: 'exact' })
      .eq('room_id', roomId);
    
    // Calculate average score
    const avgScore = players && players.length > 0
      ? players.reduce((sum, player) => sum + (player.score || 0), 0) / players.length
      : 0;
    
    // Get total activations
    const { count: totalActivations } = await supabase
      .from('activations')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('is_template', false);
    
    // Get analytics events for this room
    const { data: roomEvents } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('room_id', roomId)
      .gte('created_at', startDate);
    
    // Count total answers and correct answers
    const totalAnswers = roomEvents?.filter(e => e.event_type === 'question_answer').length || 0;
    const correctAnswers = roomEvents?.filter(e => 
      e.event_type === 'question_answer' && e.event_data?.is_correct === true
    ).length || 0;
    
    const correctRate = totalAnswers > 0 ? (correctAnswers / totalAnswers * 100) : 0;
    
    // Get recent players
    const { data: recentPlayers } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Get top players
    const { data: topPlayers } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('score', { ascending: false })
      .limit(5);
    
    // Get answer history events
    const { data: answerHistory } = await supabase
      .from('analytics_events')
      .select('*, activations(question)')
      .eq('room_id', roomId)
      .eq('event_type', 'question_answer')
      .order('created_at', { ascending: false })
      .limit(10);
    
    return {
      total_players: totalPlayers || 0,
      total_activations: totalActivations || 0,
      total_answers: totalAnswers,
      average_score: parseFloat(avgScore.toFixed(1)),
      correct_answer_rate: parseFloat(correctRate.toFixed(1)),
      recent_players: recentPlayers || [],
      top_players: topPlayers || [],
      answer_history: answerHistory || []
    };
  };

  if (!roomId) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          <span>Room ID is required to view analytics.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">
            {roomName ? `Analytics for ${roomName}` : 'Room Analytics'}
          </h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 appearance-none"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              title="Refresh analytics"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}

        {/* Summary Cards */}
        {loading && !summary ? (
          <div className="flex justify-center items-center p-12">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 mr-4">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Players</p>
                  <p className="text-2xl font-semibold text-gray-700">{summary?.total_players || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 mr-4">
                  <BarChart4 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Activations</p>
                  <p className="text-2xl font-semibold text-gray-700">{summary?.total_activations || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 mr-4">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Average Score</p>
                  <p className="text-2xl font-semibold text-gray-700">{summary?.average_score || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-yellow-100 mr-4">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Correct Rate</p>
                  <p className="text-2xl font-semibold text-gray-700">{summary?.correct_answer_rate || 0}%</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Based on {summary?.total_answers || 0} answers
              </div>
            </div>
          </div>
        )}

        {/* Detailed Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Players */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Leaderboard</h2>
            
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
              </div>
            ) : summary?.top_players.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                No players available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summary?.top_players.map((player, index) => (
                      <tr key={player.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{player.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{player.score || 0}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {new Date(player.created_at).toLocaleDateString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
            
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
              </div>
            ) : summary?.answer_history.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                No recent activity recorded.
              </div>
            ) : (
              <div className="space-y-4">
                {summary?.answer_history.map((event, index) => (
                  <div key={index} className="border-l-2 border-gray-200 pl-3">
                    <div className="text-sm">
                      <span className={`font-medium ${
                        event.event_data?.is_correct ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {event.event_data?.is_correct ? 'Correct answer' : 'Wrong answer'}
                      </span>
                      {event.event_data?.player_name && (
                        <span> by <span className="text-blue-600">{event.event_data.player_name}</span></span>
                      )}
                      {event.activations?.question && (
                        <div className="mt-1 text-xs text-gray-700">
                          Question: "{event.activations.question}"
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {new Date(event.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Players */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recently Joined Players</h2>
          
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
          ) : summary?.recent_players.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No recent players.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary?.recent_players.map((player) => (
                <div key={player.id} className="flex items-center p-3 border border-gray-200 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mr-3">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{player.name}</div>
                    <div className="text-xs text-gray-500">
                      Joined {new Date(player.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Trophy className="w-4 h-4 text-yellow-500 mr-1" />
                    <span className="text-sm font-medium">{player.score || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}