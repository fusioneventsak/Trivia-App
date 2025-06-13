/*
  # Fix Game Sessions Table
  
  1. Changes
    - Drop and recreate game_sessions table with proper structure
    - Add proper foreign key constraints
    - Add unique constraint for room_id
    - Add cleanup triggers
    
  2. Description
    This migration fixes issues with game sessions by ensuring:
    - Only one session per room
    - Proper cleanup of orphaned sessions
    - Better error handling in functions
*/

-- Drop existing game sessions table and recreate with proper structure
DROP TABLE IF EXISTS game_sessions CASCADE;

CREATE TABLE game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  is_live boolean DEFAULT true,
  current_activation uuid REFERENCES activations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  -- Ensure only one session per room
  CONSTRAINT unique_room_session UNIQUE (room_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_room ON game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_active ON game_sessions(is_live);
CREATE INDEX IF NOT EXISTS idx_game_sessions_current ON game_sessions(current_activation);
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_activation ON game_sessions(room_id, current_activation);

-- Update ensure_game_session function to handle concurrent activations
CREATE OR REPLACE FUNCTION ensure_game_session()
RETURNS TRIGGER AS $$
BEGIN
  -- Use an explicit transaction to handle concurrent inserts
  BEGIN
    -- Create or update game session for this room
    INSERT INTO game_sessions (room_id, is_live, current_activation)
    VALUES (NEW.room_id, true, NEW.id)
    ON CONFLICT (room_id) 
    DO UPDATE SET 
      current_activation = NEW.id,
      is_live = true;
      
    -- Log analytics event
    INSERT INTO analytics_events (
      event_type,
      room_id,
      activation_id,
      event_data
    ) VALUES (
      'activation_started',
      NEW.room_id,
      NEW.id,
      jsonb_build_object(
        'type', NEW.type,
        'timestamp', CURRENT_TIMESTAMP
      )
    );
    
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the trigger
      RAISE WARNING 'Error in ensure_game_session: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for new activations
DROP TRIGGER IF EXISTS ensure_game_session_trigger ON activations;
CREATE TRIGGER ensure_game_session_trigger
  AFTER INSERT ON activations
  FOR EACH ROW
  WHEN (NEW.is_template = false)
  EXECUTE FUNCTION ensure_game_session();

-- Create function to handle game session cleanup
CREATE OR REPLACE FUNCTION cleanup_game_session()
RETURNS TRIGGER AS $$
BEGIN
  -- If activation is being deleted, clear it from game session
  IF TG_OP = 'DELETE' THEN
    UPDATE game_sessions
    SET current_activation = NULL
    WHERE current_activation = OLD.id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for activation cleanup
DROP TRIGGER IF EXISTS cleanup_game_session_trigger ON activations;
CREATE TRIGGER cleanup_game_session_trigger
  BEFORE DELETE ON activations
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_game_session();