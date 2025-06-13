/*
  # Enable Realtime for Game Sessions and Activations
  
  1. Changes
    - Enable realtime for game_sessions table
    - Enable realtime for activations table
    - Add publication for these tables
    
  2. Description
    This migration enables real-time updates for game sessions and activations,
    which is critical for the results page to update automatically when templates
    are activated.
*/

-- Enable realtime for game_sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;

-- Enable realtime for activations table
ALTER PUBLICATION supabase_realtime ADD TABLE activations;

-- Enable realtime for players table
ALTER PUBLICATION supabase_realtime ADD TABLE players;

-- Create function to notify game session changes
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

-- Create function to notify settings changes
CREATE OR REPLACE FUNCTION notify_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'settings_changes',
    json_build_object(
      'key', NEW.key,
      'timestamp', CURRENT_TIMESTAMP
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for settings changes, but check if they exist first
DO $$
BEGIN
  -- Check if notify_settings_insert trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'notify_settings_insert'
  ) THEN
    CREATE TRIGGER notify_settings_insert
      AFTER INSERT ON system_settings
      FOR EACH ROW
      EXECUTE FUNCTION notify_settings_changes();
  END IF;

  -- Check if notify_settings_update trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'notify_settings_update'
  ) THEN
    CREATE TRIGGER notify_settings_update
      AFTER UPDATE ON system_settings
      FOR EACH ROW
      EXECUTE FUNCTION notify_settings_changes();
  END IF;
END $$;

-- Create function to notify photo changes
CREATE OR REPLACE FUNCTION notify_photo_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'photo_changes',
    json_build_object(
      'id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      'operation', TG_OP,
      'timestamp', CURRENT_TIMESTAMP
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create photos table if it doesn't exist
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  type text DEFAULT 'image'::text CHECK (type IN ('image', 'gif'))
);

-- Create triggers for photo changes, but check if they exist first
DO $$
BEGIN
  -- Check if notify_photo_insert trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'notify_photo_insert'
  ) THEN
    CREATE TRIGGER notify_photo_insert
      AFTER INSERT ON photos
      FOR EACH ROW
      EXECUTE FUNCTION notify_photo_changes();
  END IF;

  -- Check if notify_photo_delete trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'notify_photo_delete'
  ) THEN
    CREATE TRIGGER notify_photo_delete
      AFTER DELETE ON photos
      FOR EACH ROW
      EXECUTE FUNCTION notify_photo_changes();
  END IF;
END $$;

-- Create function to handle failed photo uploads
CREATE OR REPLACE FUNCTION handle_failed_photo()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the failed photo
  INSERT INTO photo_retries (photo_id, retry_count)
  VALUES (OLD.id, 0);
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create photo_retries table if it doesn't exist
CREATE TABLE IF NOT EXISTS photo_retries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  retry_count integer DEFAULT 0,
  last_retry timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(photo_id)
);

-- Create trigger for failed photos, but check if it exists first
DO $$
BEGIN
  -- Check if log_failed_photo trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'log_failed_photo'
  ) THEN
    CREATE TRIGGER log_failed_photo
      AFTER DELETE ON photos
      FOR EACH ROW
      WHEN (OLD.type = 'image')
      EXECUTE FUNCTION handle_failed_photo();
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_photos_type_created
ON photos(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_photo_retries_photo_id
ON photo_retries(photo_id);