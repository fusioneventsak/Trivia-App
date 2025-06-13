import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart4, Activity, Users, Clock, RefreshCw, Calendar, Filter } from 'lucide-react';
import { checkIsAdmin } from '../../lib/check-admin';

interface AnalyticsSummary {
  total_users: number;
  total_rooms: number;
  total_activations: number;
  total_player_joins: number;
  total_question_answers: number;
  active_users_last_7_days: number;
  active_rooms_last_7_days: number;
}

export default function SystemAnalytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d, all
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [roomStats, setRoomStats] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<any[]>([]);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      const isAdminUser = await checkIsAdmin();
      setIsAdmin(isAdminUser);
      
      if (!isAdminUser) {
        setError('You do not have permission to access this page');
        setLoading(false);
      } else {
        fetchAnalytics();
      }
    };
    
    checkAdminStatus();
  }, []);

  // Fetch analytics data based on time range
  useEffect(() => {
    if (isAdmin) {
      fetchAnalytics();
    }
  }, [timeRange, isAdmin]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get date for filtering
      const startDate = getStartDateForRange(timeRange);
      
      // Fetch summary data
      const summaryData = await fetchSummaryData(startDate);
      setSummary(summaryData);
      
      // Fetch recent events
      const events = await fetchRecentEvents();
      setRecentEvents(events);
      
      // Fetch top rooms
      const rooms = await fetchTopRooms(startDate);
      setRoomStats(rooms);
      
      // Fetch top users
      const users = await fetchTopUsers(startDate);
      setUserStats(users);

    } catch (err: any) {
      console.error('Error fetching analytics:', err);
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

  const fetchSummaryData = async (startDate: string): Promise<AnalyticsSummary> => {
    // Get total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // Get total rooms
    const { count: totalRooms } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true });
      
    // Get total activations
    const { count: totalActivations } = await supabase
      .from('activations')
      .select('*', { count: 'exact', head: true });
    
    // Get active users in time range
    const { count: activeUsers } = await supabase
      .from('analytics_events')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', startDate)
      .not('user_id', 'is', null);
    
    // Get active rooms in time range
    const { count: activeRooms } = await supabase
      .from('analytics_events')
      .select('room_id', { count: 'exact', head: true })
      .gte('created_at', startDate)
      .not('room_id', 'is', null);
    
    // Get total player joins
    const { count: playerJoins } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'player_join');
    
    // Get total question answers
    const { count: questionAnswers } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'question_answer');
    
    return {
      total_users: totalUsers || 0,
      total_rooms: totalRooms || 0,
      total_activations: totalActivations || 0,
      active_users_last_7_days: activeUsers || 0,
      active_rooms_last_7_days: activeRooms || 0,
      total_player_joins: playerJoins || 0,
      total_question_answers: questionAnswers || 0
    };
  };

  const fetchRecentEvents = async () => {
    const { data } = await supabase
      .from('analytics_events')
      .select('*, users(email, display_name), rooms(name)')
      .order('created_at', { ascending: false })
      .limit(10);
    
    return data || [];
  };

  const fetchTopRooms = async (startDate: string) => {
    // Get rooms with most activity
    const { data } = await supabase
      .from('analytics_events')
      .select('room_id, rooms(name, subdomain), count(*)')
      .gte('created_at', startDate)
      .not('room_id', 'is', null)
      .group('room_id, rooms(name, subdomain)')
      .order('count', { ascending: false })
      .limit(5);
    
    return data || [];
  };

  const fetchTopUsers = async (startDate: string) => {
    // Get users with most activity
    const { data } = await supabase
      .from('analytics_events')
      .select('user_id, users(email, display_name), count(*)')
      .gte('created_at', startDate)
      .not('user_id', 'is', null)
      .group('user_id, users(email, display_name)')
      .order('count', { ascending: false })
      .limit(5);
    
    return data || [];
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          <span>Access denied. You need administrator permissions to view analytics.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">System Analytics</h1>
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
                  <p className="text-sm font-medium text-gray-500">Total Users</p>
                  <p className="text-2xl font-semibold text-gray-700">{summary?.total_users || 0}</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-green-600">
                {summary?.active_users_last_7_days || 0} active in selected period
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 mr-4">
                  <BarChart4 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Rooms</p>
                  <p className="text-2xl font-semibold text-gray-700">{summary?.total_rooms || 0}</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-green-600">
                {summary?.active_rooms_last_7_days || 0} active in selected period
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 mr-4">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Questions</p>
                  <p className="text-2xl font-semibold text-gray-700">{summary?.total_activations || 0}</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Across all rooms
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-yellow-100 mr-4">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Question Answers</p>
                  <p className="text-2xl font-semibold text-gray-700">{summary?.total_question_answers || 0}</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                {summary?.total_player_joins || 0} total player joins
              </div>
            </div>
          </div>
        )}

        {/* Charts and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Rooms */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Top Active Rooms</h2>
            
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
              </div>
            ) : roomStats.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                No room activity data available.
              </div>
            ) : (
              <div className="space-y-4">
                {roomStats.map((room, index) => (
                  <div key={index} className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mr-3">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{room.rooms?.name || 'Unknown Room'}</div>
                      <div className="text-xs text-gray-500">{room.rooms?.subdomain || ''}.yourdomain.com</div>
                    </div>
                    <div className="text-sm font-medium">{room.count} events</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Users */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Most Active Users</h2>
            
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
              </div>
            ) : userStats.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                No user activity data available.
              </div>
            ) : (
              <div className="space-y-4">
                {userStats.map((user, index) => (
                  <div key={index} className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-3">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{user.users?.display_name || 'Unnamed User'}</div>
                      <div className="text-xs text-gray-500">{user.users?.email || ''}</div>
                    </div>
                    <div className="text-sm font-medium">{user.count} events</div>
                  </div>
                ))}
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
            ) : recentEvents.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                No recent events recorded.
              </div>
            ) : (
              <div className="space-y-4">
                {recentEvents.map((event, index) => (
                  <div key={index} className="border-l-2 border-gray-200 pl-3">
                    <div className="text-sm">
                      <span className="font-medium">
                        {formatEventType(event.event_type)}
                      </span>
                      {event.rooms?.name && (
                        <span> in <span className="text-purple-600">{event.rooms.name}</span></span>
                      )}
                      {event.users?.display_name && (
                        <span> by <span className="text-blue-600">{event.users.display_name || event.users.email}</span></span>
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
      </div>
    </div>
  );
}

function formatEventType(type: string): string {
  switch (type) {
    case 'player_join':
      return 'Player joined';
    case 'question_answer':
      return 'Question answered';
    case 'activation_created':
      return 'Question created';
    case 'activation_started':
      return 'Question started';
    case 'room_created':
      return 'Room created';
    case 'user_login':
      return 'User logged in';
    default:
      return type.replace(/_/g, ' ');
  }
}