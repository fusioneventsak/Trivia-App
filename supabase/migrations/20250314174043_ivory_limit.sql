/*
  # Fix Game Sessions and Activations

  1. Changes
    - Drop and recreate game_sessions table with proper constraints
    - Update triggers and functions to handle activation changes
    - Add proper indexes for performance
    
  2. Description
    This migration fixes issues with game sessions and activations by:
    - Ensuring proper foreign key relationships
    - Adding proper unique constraints
    - Updating triggers to handle activation changes correctly
*/

-- Drop existing game sessions table and recreate with proper structure
DROP TABLE IF EXISTS game_sessions CASCADE;

CREATE TABLE game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  is_live boolean DEFAULT true,
  current_activation uuid REFERENCES activations(id) ON DELETE SET NULL,
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

-- Create function to track activation changes
CREATE OR REPLACE FUNCTION log_activation_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.active != NEW.active THEN
    -- If the active state has changed, log this change in activation_history
    IF NEW.activation_history IS NULL THEN
      NEW.activation_history := '[]'::jsonb;
    END IF;
    
    NEW.activation_history := NEW.activation_history || jsonb_build_object(
      'timestamp', CURRENT_TIMESTAMP,
      'action', CASE WHEN NEW.active THEN 'activated' ELSE 'deactivated' END,
      'user_id', auth.uid()
    );
    
    -- Update the appropriate timestamp
    IF NEW.active THEN
      NEW.last_activated := CURRENT_TIMESTAMP;
    ELSE
      NEW.last_deactivated := CURRENT_TIMESTAMP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to track activation changes
DROP TRIGGER IF EXISTS track_activation_changes ON activations;
CREATE TRIGGER track_activation_changes
  BEFORE UPDATE ON activations
  FOR EACH ROW
  WHEN (OLD.active IS DISTINCT FROM NEW.active)
  EXECUTE FUNCTION log_activation_change();