import React, { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRoomStore } from '../../store/roomStore';
import { useGameStore } from '../../store/gameStore';
import Sidebar from './Sidebar';
import { LayoutGrid, Menu, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { currentRoomId, setCurrentRoomId } = useGameStore();
  const { fetchRoom, rooms } = useRoomStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  
  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      
      if (!data.session) {
        // Redirect to login if not authenticated
        navigate('/login');
        return;
      }
      
      setUser(data.session.user);
    };
    
    checkAuth();
  }, [navigate]);
  
  // Set current room from URL params
  useEffect(() => {
    if (roomId && roomId !== currentRoomId) {
      setCurrentRoomId(roomId);
      
      // Fetch room details if not already in store
      if (!rooms.find(r => r.id === roomId)) {
        fetchRoom(roomId);
      }
    }
  }, [roomId, currentRoomId, setCurrentRoomId, fetchRoom, rooms]);
  
  // Find current room in store
  useEffect(() => {
    if (roomId) {
      const room = rooms.find(r => r.id === roomId);
      setCurrentRoom(room || null);
    } else {
      setCurrentRoom(null);
    }
  }, [roomId, rooms]);
  
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Mobile sidebar toggle */}
      <div className="fixed top-0 left-0 z-50 flex md:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-3 m-2 text-gray-600 bg-white rounded-md shadow-md hover:bg-gray-50"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      
      {/* Sidebar */}
      <div
        className={`fixed inset-0 z-40 flex md:static md:inset-auto md:h-screen transition-transform duration-300 ease-in-out transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
        
        {/* Backdrop for mobile */}
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 md:hidden ${
            sidebarOpen ? 'block' : 'hidden'
          }`}
          onClick={() => setSidebarOpen(false)}
        ></div>
      </div>
      
      {/* Main content */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        {/* Room header */}
        {currentRoom && (
          <header className="flex items-center justify-between p-4 bg-white shadow-sm">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 mr-2 text-gray-600 rounded-md md:hidden hover:bg-gray-100"
              >
                <Menu size={20} />
              </button>
              <div className="flex items-center">
                {currentRoom.logo_url ? (
                  <img 
                    src={currentRoom.logo_url} 
                    alt={currentRoom.name} 
                    className="w-8 h-8 mr-2 rounded-md"
                  />
                ) : (
                  <div 
                    className="flex items-center justify-center w-8 h-8 mr-2 text-white rounded-md"
                    style={{ backgroundColor: currentRoom.theme?.primary_color || '#6366F1' }}
                  >
                    <LayoutGrid size={16} />
                  </div>
                )}
                <h1 className="text-xl font-semibold text-gray-800">
                  {currentRoom.name}
                </h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Room controls could go here */}
            </div>
          </header>
        )}
        
        {/* Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}