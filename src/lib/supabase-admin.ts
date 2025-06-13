import { createClient } from '@supabase/supabase-js';

// This client should only be used on admin routes with verified permissions
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Helper function to check if user is a room owner
export const isRoomOwner = async (roomId: string, userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('id')
    .eq('id', roomId)
    .eq('owner_id', userId)
    .single();
    
  return !!data && !error;
};

// Helper function to check if user has access to a room
export const hasRoomAccess = async (roomId: string, userId: string) => {
  // First check if user is the room owner
  const isOwner = await isRoomOwner(roomId, userId);
  if (isOwner) return true;
  
  // Then check if user has host controls for this room
  const { data, error } = await supabaseAdmin
    .from('host_controls')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .single();
    
  return !!data && !error;
};

// Helper to create host access for a room
export const createHostAccess = async (roomId: string, userId: string, expiresInHours = 24) => {
  // Generate random 6-character access code
  const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);
  
  const { data, error } = await supabaseAdmin
    .from('host_controls')
    .upsert({
      room_id: roomId,
      user_id: userId,
      access_code: accessCode,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
};