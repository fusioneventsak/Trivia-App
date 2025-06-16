import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { usePollManager } from '../hooks/usePollManager';
import { Loader2, AlertCircle } from 'lucide-react';

interface ResultsProps {
  code?: string;
}

const Results: React.FC<ResultsProps> = ({ code: propCode }) => {
  const { code: urlCode } = useParams<{ code: string }>();
  const code = propCode || urlCode;
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [currentActivation, setCurrentActivation] = useState<any>(null);
  
  // Load room and current activation
  useEffect(() => {
    if (!code) {
      setError('Room code is required');
      setLoading(false);
      return;
    }
    
    const loadRoom = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get room by code
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', code.toUpperCase())
          .single();
          
        if (roomError) {
          throw new Error('Room not found');
        }
        
        setRoom(roomData);
        
        // Get current game session
        const { data: sessionData, error: sessionError } = await supabase
          .from('game_sessions')
          .select('current_activation')
          .eq('room_id', roomData.id)
          .single();
          
        if (sessionError) {
          console.error('Error fetching game session:', sessionError);
          // Don't throw here, just continue without an activation
        } else if (sessionData?.current_activation) {
          // Get current activation
          const { data: activationData, error: activationError } = await supabase
            .from('activations')
            .select('*')
            .eq('id', sessionData.current_activation)
            .single();
            
          if (!activationError && activationData) {
            setCurrentActivation(activationData);
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading room:', err);
        setError(err.message || 'Failed to load room');
        setLoading(false);
      }
    };
    
    loadRoom();
    
    // Set up subscription for game session changes
    const gameSessionSubscription = supabase.channel(`game_session_${code}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `room_id=eq.${room?.id}`
      }, (payload) => {
        // If current_activation changed, reload
        if (payload.new && payload.old && 
            payload.new.current_activation !== payload.old.current_activation) {
          loadRoom();
        }
      })
      .subscribe();
      
    return () => {
      gameSessionSubscription.unsubscribe();
    };
  }, [code, room?.id]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Results</h2>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">Error</h2>
          <p className="text-gray-600 mb-4 text-center">{error}</p>
        </div>
      </div>
    );
  }
  
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">Room Not Found</h2>
          <p className="text-gray-600 mb-4 text-center">
            The room with code {code} could not be found.
          </p>
        </div>
      </div>
    );
  }
  
  // Render room results
  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: `linear-gradient(to bottom right, ${room.theme?.primary_color || theme.primary_color}, ${room.theme?.secondary_color || theme.secondary_color})`,
        color: room.theme?.text_color || theme.text_color
      }}
    >
      <div className="container mx-auto p-4">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            {room.logo_url && (
              <img 
                src={room.logo_url} 
                alt={room.name} 
                className="h-10 w-auto mr-3"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <h1 className="text-2xl font-bold">{room.name}</h1>
          </div>
          <div className="bg-white/20 px-3 py-1 rounded-full text-sm">
            Room {room.room_code}
          </div>
        </header>
        
        <main className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
          {currentActivation ? (
            <div>
              <h2 className="text-xl font-semibold mb-4">{currentActivation.question}</h2>
              
              {/* Render different content based on activation type */}
              {currentActivation.type === 'poll' && (
                <div>
                  {/* This is where we would use the poll results component */}
                  <p>Poll results would be displayed here</p>
                </div>
              )}
              
              {currentActivation.type === 'multiple_choice' && (
                <div>
                  <p>Multiple choice results would be displayed here</p>
                </div>
              )}
              
              {currentActivation.type === 'text_answer' && (
                <div>
                  <p>Text answer results would be displayed here</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-3">Waiting for the next activity...</h2>
              <p>
                The host will start the next question or poll soon.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Results;