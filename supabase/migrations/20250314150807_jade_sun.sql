/*
  # Add index for room code lookups
  
  1. Changes
    - Add index on room_code column for faster lookups
    - Add index on room_id for game_sessions
    
  2. Description
    This improves performance for room code lookups and game session queries
*/

-- Add index for room code lookups
CREATE INDEX IF NOT EXISTS idx_rooms_code
ON rooms(room_code);

-- Add index for game sessions by room
CREATE INDEX IF NOT EXISTS idx_game_sessions_room
ON game_sessions(room_id);

-- Add index for active game sessions
CREATE INDEX IF NOT EXISTS idx_game_sessions_active
ON game_sessions(is_live);