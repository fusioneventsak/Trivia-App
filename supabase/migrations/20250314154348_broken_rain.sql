/*
  # Fix Real-time Updates
  
  1. Changes
    - Add indexes for real-time subscriptions
    - Add trigger for game session updates
    - Add trigger for activation state changes
    
  2. Description
    This migration adds the necessary database changes to ensure
    real-time updates work properly across all clients.
*/

-- Add indexes for real-time subscriptions
CREATE INDEX IF NOT EXISTS idx_activations_room_template
ON activations(room_id, is_template);

CREATE INDEX IF NOT EXISTS idx_activations_parent
ON activations(parent_id);

CREATE INDEX IF NOT EXISTS idx_game_sessions_current
ON game_sessions(current_activation);

-- Create function to notify clients of activation changes
CREATE OR REPLACE FUNCTION notify_activation_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the room_id for this activation
  DECLARE
    v_room_id uuid;
  BEGIN
    SELECT room_id INTO v_room_id
    FROM activations
    WHERE id = NEW.id;

    -- Notify through PostgreSQL channel
    PERFORM pg_notify(
      'activation_changes',
      json_build_object(
        'room_id', v_room_id,
        'activation_id', NEW.id,
        'type', TG_OP,
        'record', row_to_json(NEW)
      )::text
    );
  END;
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

-- Add unique constraint on room_id for game sessions
ALTER TABLE game_sessions
DROP CONSTRAINT IF EXISTS unique_room_session;

ALTER TABLE game_sessions
ADD CONSTRAINT unique_room_session UNIQUE (room_id);