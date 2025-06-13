import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useRoomStore } from '../../store/roomStore';
import { Edit, Trash, ExternalLink, PlusCircle, Users, BarChart, Calendar, Loader2, AlertCircle, ArrowRight, Briefcase, RefreshCw, Search, Copy, Check, Shield, EyeOff, Eye } from 'lucide-react';
import { getCurrentSession, refreshToken, checkSupabaseConnection } from '../../lib/supabase';
import { useCustomer } from '../../context/CustomerContext';

export default function RoomList() {
  const navigate = useNavigate();
  const { rooms, fetchRooms, isLoading, deleteRoom } = useRoomStore();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [localLoading, setLocalLoading] = useState(true);
  const { navigateToCustomer } = useCustomer();
  const [customerGroups, setCustomerGroups] = useState<{[key: string]: any[]}>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ isConnected: boolean, message: string | null }>({
    isConnected: true,
    message: null
  });

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLocalLoading(true);
      setAuthError(null);
      
      // First check connection status
      const status = await checkSupabaseConnection();
      setConnectionStatus(status);
      
      if (!status.isConnected) {
        setAuthError(status.message || 'Connection error. Please try again.');
        setLocalLoading(false);
        return;
      }
      
      // Refresh token to ensure we have a valid session
      await refreshToken();
      
      // Fetch rooms
      await fetchRooms();
      setAuthError(null);
    } catch (error) {
      console.error('Error loading rooms:', error);
      setAuthError('Could not load rooms. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDelete === id) {
      try {
        const success = await deleteRoom(id);
        if (success) {
          setConfirmDelete(null);
        }
      } catch (error) {
        console.error('Error deleting room:', error);
        setAuthError('Failed to delete room. Please try again.');
      }
    } else {
      setConfirmDelete(id);
    }
  };

  const cancelDelete = () => {
    setConfirmDelete(null);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    loadRooms();
  };

  const handleRoomClick = (room: any) => {
    navigate(`/${room.customer_id || 'ak'}/admin/activations/${room.id}`);
  };

  const handleCreateRoom = () => {
    navigate('/ak/admin/rooms/create');
  };

  const copyRoomCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filter rooms based on search query
  const filteredRooms = rooms.filter(room => 
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.subdomain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.room_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Group rooms by active/inactive for better user experience
  const activeRooms = filteredRooms.filter(room => room.is_active);
  const inactiveRooms = filteredRooms.filter(room => !room.is_active);

  if (!connectionStatus.isConnected) {
    return (
      <div className="p-6">
        <div className="p-8 bg-red-50 rounded-lg shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-red-700 mb-2">Connection Error</h2>
          <p className="text-gray-700 mb-6">{connectionStatus.message || 'Unable to connect to the database.'}</p>
          <button 
            onClick={handleRetry}
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
        <h1 className="text-2xl font-bold text-gray-800">Room Management</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRooms}
            disabled={localLoading}
            className="p-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            title="Refresh rooms"
          >
            <RefreshCw className={`w-5 h-5 ${localLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCreateRoom}
            className="flex items-center gap-1 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
          >
            <PlusCircle className="w-4 h-4" />
            Create Room
          </button>
        </div>
      </div>

      {authError && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>{authError}</span>
            </div>
            <button 
              onClick={handleRetry}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search rooms by name, subdomain, or code..."
            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {localLoading ? (
        <div className="flex justify-center items-center my-12">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin"></div>
          <p className="ml-3 text-lg text-gray-700">Loading rooms...</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Rooms Found</h2>
          <p className="text-gray-500 mb-6">
            {searchQuery ? 'No rooms match your search criteria.' : 'Create your first room to get started.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleCreateRoom}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Create First Room
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Active Rooms Section */}
          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-green-600" /> 
              Active Rooms ({activeRooms.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeRooms.map(room => (
                <div
                  key={room.id}
                  className="bg-white rounded-lg shadow-sm overflow-hidden border border-green-200 hover:shadow-md transition"
                >
                  <div 
                    className="h-3"
                    style={{ backgroundColor: room.theme?.primary_color || '#6366F1' }}
                  ></div>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-800 truncate">
                        {room.name}
                      </h2>
                      <div className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                        Active
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {room.room_code}
                      </div>
                      <button
                        onClick={() => copyRoomCode(room.room_code)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        title="Copy room code"
                      >
                        {copiedCode === room.room_code ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <Link
                        to={`/results/${room.room_code}`}
                        target="_blank"
                        className="text-purple-600 hover:text-purple-700 flex items-center gap-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Results
                      </Link>
                    </div>

                    <div className="flex pt-3 mt-4 border-t">
                      <button
                        onClick={() => handleRoomClick(room)}
                        className="flex items-center justify-center flex-1 px-3 py-2 mr-2 text-sm text-white rounded-md"
                        style={{ backgroundColor: room.theme?.primary_color || '#6366F1' }}
                      >
                        Manage Activations
                      </button>

                      <div className="flex">
                        <button
                          onClick={() => navigate(`/admin/rooms/edit/${room.id}`)}
                          className="p-2 mr-1 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                          title="Edit room"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        {confirmDelete === room.id ? (
                          <div className="flex">
                            <button
                              onClick={() => handleDelete(room.id)}
                              className="p-2 mr-1 text-white bg-red-600 rounded-md hover:bg-red-700"
                              title="Confirm delete"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelDelete}
                              className="p-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                              title="Cancel"
                            >
                              <span className="w-4 h-4 block text-center">✕</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDelete(room.id)}
                            className="p-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                            title="Delete room"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Inactive Rooms Section */}
          {inactiveRooms.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
                <EyeOff className="w-5 h-5 mr-2 text-gray-600" />
                Inactive Rooms ({inactiveRooms.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {inactiveRooms.map(room => (
                  <div
                    key={room.id}
                    className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition opacity-75"
                  >
                    <div 
                      className="h-3"
                      style={{ backgroundColor: room.theme?.primary_color || '#6366F1' }}
                    ></div>
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800 truncate">
                          {room.name}
                        </h2>
                        <div className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                          Inactive
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-4">
                        <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {room.room_code}
                        </div>
                        <button
                          onClick={() => copyRoomCode(room.room_code)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                          title="Copy room code"
                        >
                          {copiedCode === room.room_code ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="flex pt-3 mt-4 border-t">
                        <button
                          onClick={() => navigate(`/admin/rooms/edit/${room.id}`)}
                          className="flex items-center justify-center flex-1 px-3 py-2 mr-2 text-sm text-white rounded-md bg-purple-600"
                        >
                          Edit Room
                        </button>

                        <div className="flex">
                          <button
                            onClick={() => handleRoomClick(room)}
                            className="p-2 mr-1 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                            title="Manage activations"
                          >
                            <BarChart className="w-4 h-4" />
                          </button>
                          
                          {confirmDelete === room.id ? (
                            <div className="flex">
                              <button
                                onClick={() => handleDelete(room.id)}
                                className="p-2 mr-1 text-white bg-red-600 rounded-md hover:bg-red-700"
                                title="Confirm delete"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelDelete}
                                className="p-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                                title="Cancel"
                              >
                                <span className="w-4 h-4 block text-center">✕</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDelete(room.id)}
                              className="p-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                              title="Delete room"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}