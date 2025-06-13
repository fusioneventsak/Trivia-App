/*
  # Fix Game Sessions Single Row Issue
  
  1. Changes
    - Drop and recreate game_sessions table with proper structure
    - Add unique constraint on room_id to ensure one session per room
    - Update trigger to handle single row requirement properly
    - Add proper indexes for performance
    
  2. Description
    This migration fixes the issue with game sessions returning multiple rows
    by ensuring only one active session exists per room.
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

-- Update ensure_game_session function to handle conflicts properly
CREATE OR REPLACE FUNCTION ensure_game_session()
RETURNS TRIGGER AS $$
BEGIN
  -- Create or update game session for this room
  INSERT INTO game_sessions (room_id, is_live, current_activation)
  VALUES (NEW.room_id, true, NEW.id)
  ON CONFLICT (room_id) 
  DO UPDATE SET 
    current_activation = NEW.id,
    is_live = true;
  
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

-- Create function to notify clients of activation changes
CREATE OR REPLACE FUNCTION notify_activation_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify through PostgreSQL channel
  PERFORM pg_notify(
    'activation_changes',
    json_build_object(
      'room_id', NEW.room_id,
      'activation_id', NEW.id,
      'type', TG_OP,
      'record', row_to_json(NEW)
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for activation changes
DROP TRIGGER IF EXISTS notify_activation_changes ON activations;
CREATE TRIGGER notify_activation_changes
  AFTER INSERT OR UPDATE
  ON activations
  FOR EACH ROW
  EXECUTE FUNCTION notify_activation_change();

-- Add indexes for activation lookups
CREATE INDEX IF NOT EXISTS idx_activations_room_template 
ON activations(room_id, is_template);

CREATE INDEX IF NOT EXISTS idx_activations_parent 
ON activations(parent_id);

CREATE INDEX IF NOT EXISTS idx_activations_room_active 
ON activations(room_id, active);