-- Add trigger to notify on game session changes
CREATE OR REPLACE FUNCTION notify_game_session_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify through PostgreSQL channel
  PERFORM pg_notify(
    'game_session_changes',
    json_build_object(
      'room_id', NEW.room_id,
      'current_activation', NEW.current_activation,
      'is_live', NEW.is_live,
      'timestamp', CURRENT_TIMESTAMP
    )::text
  );
  
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