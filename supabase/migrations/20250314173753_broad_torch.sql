/*
  # Fix Game Sessions and Unique Constraints
  
  1. Changes
    - Drop and recreate game sessions table with proper constraints
    - Add proper indexes for performance
    - Update triggers to handle game session creation properly
*/

-- Drop existing game sessions table and recreate with proper structure
DROP TABLE IF EXISTS game_sessions CASCADE;

CREATE TABLE game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  is_live boolean DEFAULT true,
  current_activation text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(room_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_room ON game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_active ON game_sessions(is_live);
CREATE INDEX IF NOT EXISTS idx_game_sessions_current ON game_sessions(current_activation);
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_activation ON game_sessions(room_id, current_activation);

-- Update ensure_game_session function to handle conflicts properly
CREATE OR REPLACE FUNCTION ensure_game_session()
RETURNS TRIGGER AS $$
BEGIN
  -- Create game session if it doesn't exist
  INSERT INTO game_sessions (room_id, is_live, current_activation)
  VALUES (NEW.room_id, true, NEW.id)
  ON CONFLICT (room_id) 
  DO UPDATE SET 
    current_activation = NEW.id,
    is_live = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS ensure_game_session_trigger ON activations;
CREATE TRIGGER ensure_game_session_trigger
  AFTER INSERT ON activations
  FOR EACH ROW
  WHEN (NEW.is_template = false)
  EXECUTE FUNCTION ensure_game_session();