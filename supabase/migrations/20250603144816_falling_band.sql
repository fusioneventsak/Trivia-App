-- Make sure RLS is enabled on all tables
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_access ENABLE ROW LEVEL SECURITY;

-- Ensure all rooms have proper room codes
UPDATE public.rooms
SET room_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4))
WHERE room_code IS NULL OR LENGTH(room_code) != 4;

-- Fix any rooms with missing theme data
UPDATE public.rooms
SET theme = jsonb_build_object(
  'primary_color', '#6366F1',
  'secondary_color', '#8B5CF6',
  'background_color', '#F3F4F6',
  'text_color', '#1F2937'
)
WHERE theme IS NULL OR theme = '{}'::jsonb;

-- Fix any rooms with missing settings
UPDATE public.rooms
SET settings = jsonb_build_object(
  'max_players', 500,
  'require_approval', false,
  'show_leaderboard', true,
  'allow_guest_players', true
)
WHERE settings IS NULL OR settings = '{}'::jsonb;

-- Ensure all rooms are active by default
UPDATE public.rooms
SET is_active = true
WHERE is_active IS NULL;

-- Create comprehensive RLS policies for room access
-- First check if policies exist before creating them
DO $$
BEGIN
  -- Drop and recreate room policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view active rooms' AND tablename = 'rooms') THEN
    DROP POLICY "Public can view active rooms" ON public.rooms;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create rooms' AND tablename = 'rooms') THEN
    DROP POLICY "Users can create rooms" ON public.rooms;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Room owners can manage their rooms' AND tablename = 'rooms') THEN
    DROP POLICY "Room owners can manage their rooms" ON public.rooms;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all rooms' AND tablename = 'rooms') THEN
    DROP POLICY "Admins can manage all rooms" ON public.rooms;
  END IF;
  
  -- Create new room policies
  CREATE POLICY "Public can view active rooms"
    ON public.rooms
    FOR SELECT
    TO public
    USING (is_active = true);
  
  CREATE POLICY "Users can create rooms"
    ON public.rooms
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_id);
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Room owners can manage their rooms' AND tablename = 'rooms') THEN
    CREATE POLICY "Room owners can manage their rooms"
      ON public.rooms
      FOR ALL
      TO authenticated
      USING (auth.uid() = owner_id)
      WITH CHECK (auth.uid() = owner_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all rooms' AND tablename = 'rooms') THEN
    CREATE POLICY "Admins can manage all rooms"
      ON public.rooms
      FOR ALL
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

-- Ensure all activations have proper room references
UPDATE public.activations
SET room_id = (SELECT id FROM public.rooms LIMIT 1)
WHERE room_id IS NULL AND EXISTS (SELECT 1 FROM public.rooms LIMIT 1);

-- Create comprehensive RLS policies for activations
DO $$
BEGIN
  -- Drop and recreate activation policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public to insert activations' AND tablename = 'activations') THEN
    DROP POLICY "Allow public to insert activations" ON public.activations;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public to read activations' AND tablename = 'activations') THEN
    DROP POLICY "Allow public to read activations" ON public.activations;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access activations' AND tablename = 'activations') THEN
    DROP POLICY "Admin full access activations" ON public.activations;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'owners_manage_activations' AND tablename = 'activations') THEN
    DROP POLICY "owners_manage_activations" ON public.activations;
  END IF;
  
  -- Create new activation policies
  CREATE POLICY "Allow public to insert activations"
    ON public.activations
    FOR INSERT
    TO public
    WITH CHECK (true);
  
  CREATE POLICY "Allow public to read activations"
    ON public.activations
    FOR SELECT
    TO public
    USING (true);
  
  CREATE POLICY "Admin full access activations"
    ON public.activations
    FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
  
  CREATE POLICY "owners_manage_activations"
    ON public.activations
    FOR ALL
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = activations.room_id
      AND rooms.owner_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = activations.room_id
      AND rooms.owner_id = auth.uid()
    ));
END $$;

-- Ensure all players have proper room references
UPDATE public.players
SET room_id = (SELECT id FROM public.rooms LIMIT 1)
WHERE room_id IS NULL AND EXISTS (SELECT 1 FROM public.rooms LIMIT 1);

-- Create comprehensive RLS policies for players
DO $$
BEGIN
  -- Drop and recreate player policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access to players' AND tablename = 'players') THEN
    DROP POLICY "Allow public read access to players" ON public.players;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public to insert players' AND tablename = 'players') THEN
    DROP POLICY "Allow public to insert players" ON public.players;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to update player scores' AND tablename = 'players') THEN
    DROP POLICY "Allow authenticated users to update player scores" ON public.players;
  END IF;
  
  -- Create new player policies
  CREATE POLICY "Allow public read access to players"
    ON public.players
    FOR SELECT
    TO public
    USING (true);
  
  CREATE POLICY "Allow public to insert players"
    ON public.players
    FOR INSERT
    TO public
    WITH CHECK (true);
  
  CREATE POLICY "Allow authenticated users to update player scores"
    ON public.players
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
END $$;

-- Ensure all game sessions have proper room references
UPDATE public.game_sessions
SET room_id = (SELECT id FROM public.rooms LIMIT 1)
WHERE room_id IS NULL AND EXISTS (SELECT 1 FROM public.rooms LIMIT 1);

-- Create comprehensive RLS policies for game sessions
DO $$
BEGIN
  -- Drop and recreate game session policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view game sessions' AND tablename = 'game_sessions') THEN
    DROP POLICY "Public can view game sessions" ON public.game_sessions;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage game sessions' AND tablename = 'game_sessions') THEN
    DROP POLICY "Authenticated users can manage game sessions" ON public.game_sessions;
  END IF;
  
  -- Create new game session policies
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
END $$;

-- Create function to apply room theme to all templates
CREATE OR REPLACE FUNCTION public.apply_room_theme_to_templates(
  p_room_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_count integer := 0;
BEGIN
  -- Get room data
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Update all templates for this room
  UPDATE public.activations
  SET theme = v_room.theme
  WHERE room_id = p_room_id
  AND is_template = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- Create function to update room logo
CREATE OR REPLACE FUNCTION public.update_room_logo(
  p_room_id uuid,
  p_logo_url text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update room logo
  UPDATE public.rooms
  SET logo_url = p_logo_url
  WHERE id = p_room_id;
  
  RETURN FOUND;
END;
$$;

-- Fix any corrupted poll votes
UPDATE public.poll_votes
SET option_text = (
  SELECT options->0->>'text' 
  FROM public.activations 
  WHERE id = poll_votes.activation_id
  LIMIT 1
)
WHERE option_text IS NULL AND option_id IS NOT NULL;

-- Ensure all poll votes have proper activation references
DELETE FROM public.poll_votes
WHERE activation_id NOT IN (SELECT id FROM public.activations);

-- Create comprehensive RLS policies for poll votes
DO $$
BEGIN
  -- Drop and recreate poll vote policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Poll votes are viewable by everyone' AND tablename = 'poll_votes') THEN
    DROP POLICY "Poll votes are viewable by everyone" ON public.poll_votes;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Players can insert their own votes' AND tablename = 'poll_votes') THEN
    DROP POLICY "Players can insert their own votes" ON public.poll_votes;
  END IF;
  
  -- Create new poll vote policies
  CREATE POLICY "Poll votes are viewable by everyone"
    ON public.poll_votes
    FOR SELECT
    TO public
    USING (true);
  
  CREATE POLICY "Players can insert their own votes"
    ON public.poll_votes
    FOR INSERT
    TO public
    WITH CHECK (true);
END $$;

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