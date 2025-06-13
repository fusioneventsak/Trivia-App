/*
  # Fix Real-time Updates
  
  1. Changes
    - Add indexes for faster real-time queries
    - Add notification triggers for activation changes
    - Add constraints to ensure data consistency
    - Add functions to handle real-time updates
*/

-- Add composite index for faster activation lookups
CREATE INDEX IF NOT EXISTS idx_activations_room_active
ON activations(room_id, active);

-- Add index for game session lookups by room and activation
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_activation
ON game_sessions(room_id, current_activation);

-- Create or replace the notify_activation_change function
CREATE OR REPLACE FUNCTION notify_activation_change()
RETURNS TRIGGER AS $$
DECLARE
  room_data json;
BEGIN
  -- Get room data for the activation
  SELECT json_build_object(
    'room_id', r.id,
    'room_code', r.room_code,
    'is_active', r.is_active
  ) INTO room_data
  FROM rooms r
  WHERE r.id = NEW.room_id;

  -- Notify through PostgreSQL channel with enhanced payload
  PERFORM pg_notify(
    'activation_changes',
    json_build_object(
      'room_id', NEW.room_id,
      'activation_id', NEW.id,
      'type', TG_OP,
      'record', row_to_json(NEW),
      'room', room_data
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger is up to date
DROP TRIGGER IF EXISTS notify_activation_changes ON activations;
CREATE TRIGGER notify_activation_changes
  AFTER INSERT OR UPDATE
  ON activations
  FOR EACH ROW
  EXECUTE FUNCTION notify_activation_change();

-- Create function to ensure game session exists
CREATE OR REPLACE FUNCTION ensure_game_session()
RETURNS TRIGGER AS $$
BEGIN
  -- Create game session if it doesn't exist
  INSERT INTO game_sessions (room_id, is_live, current_activation)
  VALUES (NEW.room_id, true, NEW.id)
  ON CONFLICT (room_id) DO UPDATE
  SET current_activation = NEW.id, is_live = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure game session exists
DROP TRIGGER IF EXISTS ensure_game_session_trigger ON activations;
CREATE TRIGGER ensure_game_session_trigger
  AFTER INSERT
  ON activations
  FOR EACH ROW
  WHEN (NEW.is_template = false)
  EXECUTE FUNCTION ensure_game_session();

-- Add unique constraint for room codes if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_room_code'
  ) THEN
    ALTER TABLE rooms
    ADD CONSTRAINT unique_room_code UNIQUE (room_code);
  END IF;
END $$;

-- Create index on room codes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rooms_code
ON rooms(room_code);