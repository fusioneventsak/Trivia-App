import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomStore } from '../store/roomStore';
import { PlusCircle, LayoutGrid, Users, Activity, Calendar, BarChart4, RefreshCw, ArrowRight, Briefcase, AlertCircle, WifiOff } from 'lucide-react';
import { supabase, checkSupabaseConnection } from '../lib/supabase';
import { useCustomer } from '../context/CustomerContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { rooms, fetchRooms } = useRoomStore();
  const { navigateToCustomer } = useCustomer();
  const [stats, setStats] = useState({
    totalPlayers: 0,
    totalActivations: 0,
    totalRooms: 0,
    activeRooms: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ isConnected: boolean, message: string | null }>({
    isConnected: true,
    message: null
  });
  
  // Check connection status on component mount
  useEffect(() => {
    const checkConnection = async () => {
      const status = await checkSupabaseConnection();
      setConnectionStatus(status);
      
      if (status.isConnected) {
        // Only fetch data if connection is successful
        fetchRooms();
        fetchStats();
        fetchRecentActivity();
      }
    };
    
    checkConnection();
  }, [fetchRooms]);
  
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get total players
      const { count: playersCount, error: playersError } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true });
        
      if (playersError) throw playersError;
        
      // Get total activations
      const { count: activationsCount, error: activationsError } = await supabase
        .from('activations')
        .select('*', { count: 'exact', head: true });
        
      if (activationsError) throw activationsError;
        
      // Room stats are from the store
      const roomsData = await supabase
        .from('rooms')
        .select('*');
      
      if (roomsData.error) throw roomsData.error;
        
      setStats({
        totalPlayers: playersCount || 0,
        totalActivations: activationsCount || 0,
        totalRooms: roomsData.data?.length || 0,
        activeRooms: roomsData.data?.filter(r => r.is_active).length || 0
      });
      
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      setError('Failed to load statistics data');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchRecentActivity = async () => {
    try {
      setError(null);
      
      // Get recent player joins
      const { data: playerJoins, error: playerError } = await supabase
        .from('players')
        .select('id, name, created_at, room_id, rooms(name, customer_id)')
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (playerError) throw playerError;
        
      // Get recent activations
      const { data: recentActivations, error: activationsError } = await supabase
        .from('activations')
        .select('id, question, created_at, type, room_id, rooms(name, customer_id)')
        .eq('is_template', false)
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (activationsError) throw activationsError;
        
      // Combine and sort by date
      const combined = [
        ...(playerJoins || []).map(player => ({
          type: 'player_join',
          id: player.id,
          name: player.name,
          roomName: player.rooms?.name || 'Unknown Room',
          roomId: player.room_id,
          customerId: player.rooms?.customer_id || 'ak',
          created_at: player.created_at
        })),
        ...(recentActivations || []).map(activation => ({
          type: 'activation',
          id: activation.id,
          question: activation.question,
          activationType: activation.type,
          roomName: activation.rooms?.name || 'Unknown Room',
          roomId: activation.room_id,
          customerId: activation.rooms?.customer_id || 'ak',
          created_at: activation.created_at
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
       .slice(0, 5);
      
      setRecentActivity(combined);
    } catch (error: any) {
      console.error('Error fetching recent activity:', error);
      setError('Failed to load recent activity');
    }
  };
  
  // Retry connection and data fetch
  const handleRetryConnection = async () => {
    setLoading(true);
    setError(null);
    
    const status = await checkSupabaseConnection();
    setConnectionStatus(status);
    
    if (status.isConnected) {
      // Retry all data fetching
      await Promise.all([
        fetchRooms(),
        fetchStats(),
        fetchRecentActivity()
      ]);
    }
    
    setLoading(false);
  };
  
  // Use the CustomerContext's navigateToCustomer function
  const handleRoomClick = (room: any) => {
    // Navigate to the activation manager for this room
    navigate(`/ak/admin/activations/${room.id}`);
  };
  
  // Handle activity item click
  const handleActivityClick = (customerId: string) => {
    navigateToCustomer(customerId, 'admin');
  };

  // Group rooms by customer for easier navigation
  const roomsByCustomer = rooms.reduce((acc: {[key: string]: any[]}, room) => {
    const customerId = room.customer_id || 'ak';
    if (!acc[customerId]) {
      acc[customerId] = [];
    }
    acc[customerId].push(room);
    return acc;
  }, {});

  const handleCreateRoom = () => {
    navigate('/ak/admin/rooms/create');
  };
  
  // If there's a connection error, show a friendly message
  if (!connectionStatus.isConnected) {
    return (
      <div className="p-6">
        <div className="p-8 bg-red-50 rounded-lg shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <WifiOff className="w-10 h-10 text-red-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-red-700 mb-2">Connection Error</h2>
          <p className="text-gray-700 mb-6">{connectionStatus.message || 'Unable to connect to the Supabase backend.'}</p>
          <p className="text-gray-600 mb-6">
            This might be due to network issues or the Supabase project being unavailable.
            Please check your internet connection and Supabase configuration.
          </p>
          <button
            onClick={handleRetryConnection}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center mx-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <button
          onClick={handleCreateRoom}
          className="flex items-center px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Create Room
        </button>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          <div>
            <p>{error}</p>
            <button 
              onClick={handleRetryConnection}
              className="text-sm underline mt-1 flex items-center"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </button>
          </div>
        </div>
      )}
      
      {/* Quick Access Panel */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border-l-4 border-purple-500">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <button 
            onClick={() => navigateToCustomer('ak', 'admin')}
            className="flex items-center justify-between p-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition"
          >
            <div className="flex items-center">
              <LayoutGrid className="w-5 h-5 mr-2" />
              <span className="font-medium">Master Admin</span>
            </div>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          {Object.keys(roomsByCustomer).slice(0, 3).map(customerId => (
            customerId !== 'ak' && (
              <button 
                key={customerId}
                onClick={() => navigateToCustomer(customerId, 'admin')}
                className="flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
              >
                <div className="flex items-center">
                  <LayoutGrid className="w-5 h-5 mr-2" />
                  <span className="font-medium">{customerId} Admin</span>
                </div>
                <ArrowRight className="w-4 h-4" />
              </button>
            )
          ))}
        </div>
      </div>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-6 mb-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-purple-100 rounded-full">
              <LayoutGrid className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Rooms</p>
              <p className="text-2xl font-semibold text-gray-700">{stats.totalRooms}</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-green-600">
            {stats.activeRooms} active
          </div>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-blue-100 rounded-full">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Players</p>
              <p className="text-2xl font-semibold text-gray-700">{stats.totalPlayers}</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-green-100 rounded-full">
              <BarChart4 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Activations</p>
              <p className="text-2xl font-semibold text-gray-700">{stats.totalActivations}</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-orange-100 rounded-full">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Today</p>
              <p className="text-2xl font-semibold text-gray-700">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Rooms */}
        <div className="p-6 bg-white rounded-lg shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Recent Rooms</h2>
          
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
              <LayoutGrid className="w-12 h-12 mb-3 text-gray-400" />
              <p className="mb-4 text-gray-600">No rooms created yet</p>
              <button
                onClick={handleCreateRoom}
                className="px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700"
              >
                Create Your First Room
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.slice(0, 3).map((room) => (
                <div
                  key={room.id}
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => handleRoomClick(room)}
                >
                  <div
                    className="w-10 h-10 flex items-center justify-center rounded-md mr-4 text-white"
                    style={{ backgroundColor: room.theme?.primary_color || '#6366F1' }}
                  >
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <h3 className="text-base font-medium text-gray-900 truncate">{room.name}</h3>
                      <div className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                        room.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {room.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    <div className="flex items-center mt-1">
                      <span className="text-sm text-gray-500">Customer: </span>
                      <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">{room.customer_id || 'ak'}</span>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => navigate('/ak/admin/rooms')}
                  className="px-4 py-2 text-sm text-purple-600 hover:text-purple-800"
                >
                  View All Rooms →
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Recent Activity */}
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Recent Activity</h2>
            <button
              onClick={fetchRecentActivity}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Refresh activity"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
              <Activity className="w-10 h-10 mb-2 text-gray-400" />
              <p className="text-gray-600">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="border-l-2 border-gray-200 pl-3">
                  <div className="text-sm">
                    {activity.type === 'player_join' ? (
                      <div>
                        <span className="font-medium">{activity.name}</span>{' '}
                        joined room{' '}
                        <span 
                          className="text-purple-600 cursor-pointer hover:underline"
                          onClick={() => handleActivityClick(activity.customerId)}
                        >
                          {activity.roomName}
                        </span>
                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">{activity.customerId}</span>
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium">
                          {activity.activationType === 'multiple_choice' ? 'Question' :
                           activity.activationType === 'poll' ? 'Poll' : 'Text Question'}
                        </span>{' '}
                        activated in{' '}
                        <span 
                          className="text-purple-600 cursor-pointer hover:underline"
                          onClick={() => handleActivityClick(activity.customerId)}
                        >
                          {activity.roomName}
                        </span>
                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">{activity.customerId}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {new Date(activity.created_at).toLocaleString()}
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