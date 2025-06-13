import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, getCurrentSession, refreshToken } from '../lib/supabase';

export interface RoomTheme {
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
}

export interface RoomSettings {
  allow_guest_players: boolean;
  require_approval: boolean;
  show_leaderboard: boolean;
  max_players: number;
}

export interface Room {
  id: string;
  name: string;
  subdomain: string;
  domain?: string;
  logo_url?: string;
  settings: RoomSettings;
  theme: RoomTheme;
  is_active: boolean;
  owner_id: string;
  created_at: string;
  updated_at: string;
  customer_id?: string;
  room_code?: string;
}

interface RoomState {
  rooms: Room[];
  currentRoomId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchRooms: () => Promise<Room[]>;
  fetchRoom: (id: string) => Promise<Room | null>;
  fetchRoomByCode: (code: string) => Promise<Room | null>;
  createRoom: (room: Partial<Room>) => Promise<Room | null>;
  updateRoom: (id: string, updates: Partial<Room>) => Promise<Room | null>;
  deleteRoom: (id: string) => Promise<boolean>;
  setCurrentRoom: (roomId: string | null) => void;
  clearError: () => void;
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set, get) => ({
      rooms: [],
      currentRoomId: null,
      isLoading: false,
      error: null,
      
      fetchRooms: async () => {
        try {
          set({ isLoading: true, error: null });
          
          // First check if we have a session
          const session = await getCurrentSession();
          if (!session) {
            set({ 
              error: 'Please log in to view rooms',
              isLoading: false
            });
            return [];
          }
          
          // Refresh token to ensure it's valid
          await refreshToken();
          
          const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (error) {
            throw error;
          }
          
          // Make sure theme is not null in any room
          const roomsWithTheme = (data || []).map(room => ({
            ...room,
            theme: room.theme || {
              primary_color: '#6366F1',
              secondary_color: '#8B5CF6',
              background_color: '#F3F4F6',
              text_color: '#1F2937'
            }
          }));
          
          set({ 
            rooms: roomsWithTheme, 
            isLoading: false, 
            error: null
          });
          
          return roomsWithTheme;
        } catch (error: any) {
          console.error('Error fetching rooms:', error);
          set({ 
            error: error.message || 'Failed to load rooms',
            isLoading: false
          });
          return [];
        }
      },
      
      fetchRoom: async (id) => {
        try {
          set({ isLoading: true, error: null });
          
          // Check session
          const session = await getCurrentSession();
          if (!session) {
            throw new Error('Please log in to view room');
          }
          
          // Refresh token
          await refreshToken();
          
          const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', id)
            .single();
          
          if (error) {
            throw error;
          }
          
          // Ensure theme is not null
          const roomWithTheme = {
            ...data,
            theme: data.theme || {
              primary_color: '#6366F1',
              secondary_color: '#8B5CF6',
              background_color: '#F3F4F6',
              text_color: '#1F2937'
            }
          };
          
          set(state => ({
            rooms: state.rooms.map(room => 
              room.id === id ? roomWithTheme : room
            ),
            isLoading: false,
            error: null
          }));
          
          return roomWithTheme;
        } catch (error: any) {
          console.error('Error fetching room:', error);
          set({ 
            error: error.message || 'Failed to load room',
            isLoading: false 
          });
          return null;
        }
      },

      fetchRoomByCode: async (code) => {
        try {
          set({ isLoading: true, error: null });
          
          // Check session
          const session = await getCurrentSession();
          if (!session) {
            throw new Error('Please log in to view room');
          }
          
          const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('room_code', code)
            .single();
          
          if (error) {
            throw error;
          }
          
          // Ensure theme is not null
          const roomWithTheme = {
            ...data,
            theme: data.theme || {
              primary_color: '#6366F1',
              secondary_color: '#8B5CF6',
              background_color: '#F3F4F6',
              text_color: '#1F2937'
            }
          };
          
          set(state => ({
            rooms: state.rooms.map(room => 
              room.room_code === code ? roomWithTheme : room
            ),
            isLoading: false,
            error: null
          }));
          
          return roomWithTheme;
        } catch (error: any) {
          console.error('Error fetching room by code:', error);
          set({ 
            error: error.message || 'Failed to load room',
            isLoading: false 
          });
          return null;
        }
      },
      
      createRoom: async (room) => {
        try {
          set({ isLoading: true, error: null });
          
          // Check session
          const session = await getCurrentSession();
          if (!session) {
            throw new Error('Please log in to create room');
          }
          
          if (!room.subdomain) {
            room.subdomain = (room.name || 'room')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '');
          }
          
          // Always set customer_id to 'ak' for simplicity
          room.customer_id = room.customer_id || 'ak';
          
          // Make sure theme is a proper object
          if (room.theme) {
            room.theme = {
              ...room.theme,
              primary_color: room.theme.primary_color || '#6366F1',
              secondary_color: room.theme.secondary_color || '#8B5CF6',
              background_color: room.theme.background_color || '#F3F4F6',
              text_color: room.theme.text_color || '#1F2937'
            };
          }

          console.log('Creating room with data:', JSON.stringify(room));
          
          const { data, error } = await supabase
            .from('rooms')
            .insert([room])
            .select()
            .single();
          
          if (error) {
            throw error;
          }
          
          // Ensure theme is not null
          const newRoom = {
            ...data,
            theme: data.theme || {
              primary_color: '#6366F1',
              secondary_color: '#8B5CF6',
              background_color: '#F3F4F6',
              text_color: '#1F2937'
            }
          };
          
          set(state => ({
            rooms: [newRoom, ...state.rooms],
            isLoading: false,
            error: null
          }));
          
          return newRoom;
        } catch (error: any) {
          console.error('Error creating room:', error);
          set({ 
            error: error.message || 'Failed to create room',
            isLoading: false 
          });
          return null;
        }
      },
      
      updateRoom: async (id, updates) => {
        try {
          set({ isLoading: true, error: null });
          
          // Check session
          const session = await getCurrentSession();
          if (!session) {
            throw new Error('Please log in to update room');
          }
          
          // Make sure theme is a proper object if it exists
          if (updates.theme) {
            updates.theme = {
              ...updates.theme,
              primary_color: updates.theme.primary_color || '#6366F1',
              secondary_color: updates.theme.secondary_color || '#8B5CF6',
              background_color: updates.theme.background_color || '#F3F4F6',
              text_color: updates.theme.text_color || '#1F2937'
            };
          }
          
          console.log('Updating room with data:', JSON.stringify({
            ...updates, 
            updated_at: new Date().toISOString()
          }));
          
          const { data, error } = await supabase
            .from('rooms')
            .update({ 
              ...updates, 
              updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
          
          if (error) {
            throw error;
          }
          
          // Ensure theme is not null
          const updatedRoom = {
            ...data,
            theme: data.theme || {
              primary_color: '#6366F1',
              secondary_color: '#8B5CF6',
              background_color: '#F3F4F6',
              text_color: '#1F2937'
            }
          };
          
          set(state => ({
            rooms: state.rooms.map(room => 
              room.id === id ? updatedRoom : room
            ),
            isLoading: false,
            error: null
          }));
          
          return updatedRoom;
        } catch (error: any) {
          console.error('Error updating room:', error);
          set({ 
            error: error.message || 'Failed to update room',
            isLoading: false 
          });
          return null;
        }
      },
      
      deleteRoom: async (id) => {
        try {
          set({ isLoading: true, error: null });
          
          // Check session
          const session = await getCurrentSession();
          if (!session) {
            throw new Error('Please log in to delete room');
          }
          
          const { error } = await supabase
            .from('rooms')
            .delete()
            .eq('id', id);
          
          if (error) {
            throw error;
          }
          
          set(state => ({
            rooms: state.rooms.filter(room => room.id !== id),
            currentRoomId: state.currentRoomId === id ? null : state.currentRoomId,
            isLoading: false,
            error: null
          }));
          
          return true;
        } catch (error: any) {
          console.error('Error deleting room:', error);
          set({ 
            error: error.message || 'Failed to delete room',
            isLoading: false 
          });
          return false;
        }
      },
      
      setCurrentRoom: (roomId) => {
        set({ currentRoomId: roomId });
      },
      
      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'room-storage',
      partialize: (state) => ({
        currentRoomId: state.currentRoomId
      }),
    }
  )
);