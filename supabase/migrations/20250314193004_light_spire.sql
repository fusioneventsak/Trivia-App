-- Add trigger to notify on game session changes
CREATE OR REPLACE FUNCTION notify_game_session_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if current_activation has changed
  IF OLD.current_activation IS DISTINCT FROM NEW.current_activation THEN
    -- Notify through PostgreSQL channel
    PERFORM pg_notify(
      'game_session_changes',
      json_build_object(
        'room_id', NEW.room_id,
        'current_activation', NEW.current_activation,
        'is_live', NEW.is_live,
        'timestamp', CURRENT_TIMESTAMP,
        'event_type', 'activation_change'
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for game session changes
DROP TRIGGER IF EXISTS notify_game_session_changes ON game_sessions;
CREATE TRIGGER notify_game_session_changes
  AFTER UPDATE
  ON game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_game_session_change();

-- Add index for faster room code lookups
CREATE INDEX IF NOT EXISTS idx_rooms_code
ON rooms(room_code);

-- Add index for game session lookups
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_current
ON game_sessions(room_id, current_activation);