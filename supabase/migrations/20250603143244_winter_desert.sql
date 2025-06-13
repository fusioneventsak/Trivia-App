/*
  # Fix Game Sessions RLS Policies
  
  1. Changes
    - Enable RLS on game_sessions table
    - Add more permissive policies for game_sessions
    - Fix ensure_game_session function to handle RLS
    
  2. Description
    This migration fixes the RLS policies for game_sessions to allow
    mobile controllers to create and update game sessions properly.
*/

-- Make sure RLS is enabled on game_sessions
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Authenticated users can manage game sessions" ON public.game_sessions;

-- Create more permissive policies for game sessions
CREATE POLICY "Public can view game sessions"
  ON public.game_sessions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage game sessions"
  ON public.game_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update ensure_game_session function to use SECURITY DEFINER
-- This allows it to bypass RLS when creating game sessions
CREATE OR REPLACE FUNCTION ensure_game_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create or update game session for this room
  INSERT INTO game_sessions (room_id, is_live, current_activation)
  VALUES (NEW.room_id, true, NEW.id)
  ON CONFLICT (room_id) 
  DO UPDATE SET 
    current_activation = NEW.id,
    is_live = true;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the trigger
  RAISE WARNING 'Error in ensure_game_session: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate trigger for new activations
DROP TRIGGER IF EXISTS ensure_game_session_trigger ON activations;
CREATE TRIGGER ensure_game_session_trigger
  AFTER INSERT ON activations
  FOR EACH ROW
  WHEN (NEW.is_template = false)
  EXECUTE FUNCTION ensure_game_session();

-- Update notify_game_session_change function to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION notify_game_session_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Recreate trigger for game session changes
DROP TRIGGER IF EXISTS notify_game_session_changes ON game_sessions;
CREATE TRIGGER notify_game_session_changes
  AFTER UPDATE
  ON game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_game_session_change();