import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRoomStore } from '../../store/roomStore';
import { 
  Home, Settings, LayoutGrid, PlusCircle, Users, Trophy, 
  Puzzle, BarChart, LogOut, Database, Shield, Sliders, Loader2, Briefcase
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { checkIsAdmin } from '../../lib/check-admin';
import { useCustomer } from '../../context/CustomerContext';

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { rooms, fetchRooms, isLoading } = useRoomStore();
  const [isAdmin, setIsAdmin] = useState(false);
  const { navigateToCustomer } = useCustomer();
  const [loggingOut, setLoggingOut] = useState(false);
  const [customerGroups, setCustomerGroups] = useState<{[key: string]: any[]}>({});
  
  // Load initial data once
  useEffect(() => {
    fetchRooms().catch(console.error);
  }, []); // Empty dependency array - only run once

  // Check admin status once
  useEffect(() => {
    checkIsAdmin().then(setIsAdmin).catch(console.error);
  }, []); // Empty dependency array - only run once

  // Group rooms by customer when rooms change
  useEffect(() => {
    if (rooms && rooms.length > 0) {
      const groups = rooms.reduce((acc: {[key: string]: any[]}, room) => {
        const customerId = room.customer_id || 'ak';
        if (!acc[customerId]) {
          acc[customerId] = [];
        }
        acc[customerId].push(room);
        return acc;
      }, {});
      
      // Ensure 'ak' is first if it exists
      const ordered: {[key: string]: any[]} = {};
      if (groups['ak']) {
        ordered['ak'] = groups['ak'];
      }
      
      // Add other customers
      Object.keys(groups).sort().forEach(key => {
        if (key !== 'ak') {
          ordered[key] = groups[key];
        }
      });
      
      setCustomerGroups(ordered);
    }
  }, [rooms]);

  const handleSignOut = async () => {
    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const navigateTo = useCallback((path: string) => {
    navigate(path);
    if (onClose) onClose();
  }, [navigate, onClose]);

  const handleRoomClick = useCallback((room: any) => {
    // Navigate to the activation manager for this room
    navigate(`/${room.customer_id || 'ak'}/admin/activations/${room.id}`);
  }, [navigate]);

  const handleCustomerClick = useCallback((customerId: string) => {
    navigateToCustomer(customerId, 'admin');
    if (onClose) onClose();
  }, [navigateToCustomer, onClose]);

  const isActive = useCallback((path: string) => {
    return location.pathname === path;
  }, [location.pathname]);

  return (
    <aside className="flex flex-col w-64 h-full overflow-y-auto bg-white border-r border-gray-200">
      {/* App Title */}
      <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-purple-600">Fusion Events</h1>
      </div>
      
      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        <button
          onClick={() => navigateTo('/dashboard')}
          className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg ${
            isActive('/dashboard')
              ? 'bg-purple-100 text-purple-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Home className="w-5 h-5 mr-3" />
          Dashboard
        </button>
        
        {/* Room Management Section */}
        <div className="pt-5">
          <div className="flex items-center justify-between px-4 mb-2">
            <h3 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
              Room Management
            </h3>
            <button
              onClick={() => navigateTo('/rooms/create')}
              className="p-1 text-gray-500 rounded-md hover:bg-gray-100"
              title="Create new room"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                <span className="text-sm text-gray-500">Loading rooms...</span>
              </div>
            </div>
          ) : Object.keys(customerGroups).length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              No rooms available. Create your first room.
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(customerGroups).map(([customerId, customerRooms]) => (
                <div key={customerId} className="mb-2">
                  <button
                    onClick={() => handleCustomerClick(customerId)}
                    className="flex items-center w-full px-4 py-2 mb-1 text-sm font-medium text-left bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Briefcase className="w-4 h-4 mr-2 text-gray-600" />
                    <span className="font-semibold">{customerId === 'ak' ? 'Master Admin' : `${customerId} Admin`}</span>
                    <span className="ml-auto text-xs text-gray-500">{customerRooms.length}</span>
                  </button>
                  
                  <div className="space-y-1 pl-4">
                    {customerRooms.slice(0, 3).map(room => (
                      <button
                        key={room.id}
                        onClick={() => handleRoomClick(room)}
                        className={`flex items-center w-full px-4 py-2 text-sm rounded-lg ${
                          location.pathname.includes(`/admin/activations/${room.id}`)
                            ? 'bg-purple-100 text-purple-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <LayoutGrid className="w-4 h-4 mr-3" />
                        <span className="truncate">{room.name}</span>
                      </button>
                    ))}
                    
                    {customerRooms.length > 3 && (
                      <div className="text-xs text-purple-600 pl-4 py-1">
                        + {customerRooms.length - 3} more rooms
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button
            onClick={() => navigateTo('/rooms')}
            className="flex items-center w-full px-4 py-2 mt-2 text-sm text-left text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <span className="text-purple-600 underline">Manage all rooms</span>
          </button>
        </div>
      </nav>
      
      {/* User Profile & Footer */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          disabled={loggingOut}
          className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          {loggingOut ? (
            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
          ) : (
            <LogOut className="w-5 h-5 mr-3" />
          )}
          Sign Out
        </button>
      </div>
    </aside>
  );
}