/*
  # Fix RLS and secure functions

  1. New Functions
    - Enable RLS on tables that need it
    - Create secure versions of existing functions with SECURITY DEFINER
    - Fix game_sessions policies for mobile controller
    - Add apply_room_theme_to_templates function with proper checks
  
  2. Security
    - Add SECURITY DEFINER to functions that need elevated permissions
    - Set proper search_path for all functions
*/

-- Enable RLS on tables that have policies but RLS is not enabled
ALTER TABLE IF EXISTS public.activation_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.question_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rooms ENABLE ROW LEVEL SECURITY;

-- Fix game_sessions policies to allow mobile controller to work
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Authenticated users can manage game sessions" ON public.game_sessions;
  DROP POLICY IF EXISTS "Public can view game sessions" ON public.game_sessions;
  
  -- Create new policies with proper permissions
  CREATE POLICY "Authenticated users can manage game sessions"
    ON public.game_sessions FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
    
  CREATE POLICY "Public can view and manage game sessions"
    ON public.game_sessions FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);
END
$$;

-- Create a new version of ensure_game_session with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.ensure_game_session_secure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create a game session for this room if one doesn't exist
  INSERT INTO public.game_sessions (room_id, current_activation, is_live)
  SELECT 
    NEW.room_id, 
    NEW.id,
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.game_sessions WHERE room_id = NEW.room_id
  );
  
  -- Update existing game session if it exists
  UPDATE public.game_sessions
  SET current_activation = NEW.id
  WHERE room_id = NEW.room_id
    AND current_activation IS DISTINCT FROM NEW.id;
    
  RETURN NEW;
END;
$$;

-- Create a new version of validate_activation with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.validate_activation_secure(activation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  activation_record record;
BEGIN
  -- Get the activation
  SELECT * INTO activation_record FROM activations WHERE id = activation_id;
  
  IF activation_record IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Activation not found'
    );
  END IF;
  
  -- Basic validation
  result := jsonb_build_object(
    'valid', true,
    'message', 'Activation is valid',
    'type', activation_record.type,
    'has_media', activation_record.media_type != 'none'
  );
  
  -- Type-specific validation
  CASE activation_record.type
    WHEN 'multiple_choice' THEN
      IF activation_record.options IS NULL OR jsonb_array_length(activation_record.options) < 2 THEN
        result := jsonb_set(result, '{valid}', 'false');
        result := jsonb_set(result, '{message}', '"Multiple choice questions require at least 2 options"');
      END IF;
      
      IF activation_record.correct_answer IS NULL THEN
        result := jsonb_set(result, '{valid}', 'false');
        result := jsonb_set(result, '{message}', '"Multiple choice questions require a correct answer"');
      END IF;
      
    WHEN 'text_answer' THEN
      IF activation_record.exact_answer IS NULL THEN
        result := jsonb_set(result, '{valid}', 'false');
        result := jsonb_set(result, '{message}', '"Text answer questions require an exact answer"');
      END IF;
      
    WHEN 'poll' THEN
      IF activation_record.options IS NULL OR jsonb_array_length(activation_record.options) < 2 THEN
        result := jsonb_set(result, '{valid}', 'false');
        result := jsonb_set(result, '{message}', '"Polls require at least 2 options"');
      END IF;
  END CASE;
  
  RETURN result;
END;
$$;

-- Create a new version of check_cross_room_compatibility with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.check_cross_room_compatibility_secure(activation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  activation_record record;
BEGIN
  -- Get the activation
  SELECT * INTO activation_record FROM activations WHERE id = activation_id;
  
  IF activation_record IS NULL THEN
    RETURN jsonb_build_object(
      'compatible', false,
      'message', 'Activation not found'
    );
  END IF;
  
  -- Check if this activation can be used in other rooms
  result := jsonb_build_object(
    'compatible', true,
    'message', 'Activation is compatible with other rooms',
    'restrictions', jsonb_build_array()
  );
  
  -- Add any compatibility restrictions
  IF activation_record.room_id IS NOT NULL THEN
    result := jsonb_set(result, '{restrictions}', result->'restrictions' || jsonb_build_object(
      'type', 'room_specific',
      'message', 'This activation is specific to a room and may not work correctly in other rooms'
    ));
  END IF;
  
  RETURN result;
END;
$$;

-- Create a new version of get_poll_votes with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_poll_votes_secure(activation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Get votes for this activation
  WITH vote_counts AS (
    SELECT 
      option_id,
      option_text,
      COUNT(*) as vote_count
    FROM poll_votes
    WHERE activation_id = $1
    GROUP BY option_id, option_text
  ),
  total_votes AS (
    SELECT COUNT(*) as total
    FROM poll_votes
    WHERE activation_id = $1
  )
  SELECT 
    jsonb_build_object(
      'votes', COALESCE(jsonb_object_agg(option_id, vote_count), '{}'::jsonb),
      'votes_by_text', COALESCE(jsonb_object_agg(option_text, vote_count), '{}'::jsonb),
      'total_votes', (SELECT total FROM total_votes)
    )
  INTO result
  FROM vote_counts;
  
  -- If no votes yet, return empty result
  IF result IS NULL THEN
    result := jsonb_build_object(
      'votes', '{}'::jsonb,
      'votes_by_text', '{}'::jsonb,
      'total_votes', 0
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Create a new version of has_player_voted with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_player_voted_secure(activation_id uuid, player_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM poll_votes
    WHERE activation_id = $1 AND player_id = $2
  );
END;
$$;

-- Create a new version of update_room_theme with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.update_room_theme_secure(room_id uuid, new_theme jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update room theme
  UPDATE rooms
  SET theme = new_theme
  WHERE id = room_id;
END;
$$;

-- Create a new version of set_room_code with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.set_room_code_secure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Only set room_code if it's not already set
  IF NEW.room_code IS NULL THEN
    -- Generate a random 4-character code
    LOOP
      new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
      
      -- Check if this code already exists
      SELECT EXISTS(
        SELECT 1 FROM rooms WHERE room_code = new_code
      ) INTO code_exists;
      
      -- If code doesn't exist, use it
      IF NOT code_exists THEN
        NEW.room_code := new_code;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create a new version of fix_player_stats with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.fix_player_stats_secure()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update players with missing stats
  UPDATE players
  SET stats = jsonb_build_object(
    'totalPoints', COALESCE(score, 0),
    'correctAnswers', 0,
    'totalAnswers', 0,
    'averageResponseTimeMs', 0
  )
  WHERE stats IS NULL OR stats = '{}'::jsonb;
END;
$$;

-- Create a new version of generate_option_ids with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.generate_option_ids_secure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  options_array jsonb;
  i integer;
  option_obj jsonb;
BEGIN
  -- Only process if we have options and they're for a poll or multiple choice
  IF (NEW.options IS NOT NULL AND jsonb_array_length(NEW.options) > 0 AND 
      (NEW.type = 'poll' OR NEW.type = 'multiple_choice')) THEN
    
    options_array := NEW.options;
    
    -- Loop through each option
    FOR i IN 0..jsonb_array_length(options_array) - 1 LOOP
      option_obj := options_array->i;
      
      -- Add an id if it doesn't exist
      IF option_obj->>'id' IS NULL THEN
        option_obj := jsonb_set(option_obj, '{id}', to_jsonb(gen_random_uuid()::text));
        options_array := jsonb_set(options_array, array[i::text], option_obj);
      END IF;
    END LOOP;
    
    NEW.options := options_array;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create a new version of is_admin with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_admin_secure()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is an admin
  RETURN EXISTS (
    SELECT 1
    FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Create a new version of check_options_format with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.check_options_format_secure(options jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i integer;
  option_obj jsonb;
BEGIN
  -- If options is null, return true (no validation needed)
  IF options IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if options is an array
  IF jsonb_typeof(options) != 'array' THEN
    RETURN FALSE;
  END IF;
  
  -- Loop through each option
  FOR i IN 0..jsonb_array_length(options) - 1 LOOP
    option_obj := options->i;
    
    -- Check if option is an object
    IF jsonb_typeof(option_obj) != 'object' THEN
      RETURN FALSE;
    END IF;
    
    -- Check if option has required text field
    IF option_obj->>'text' IS NULL THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$;

-- Check if apply_room_theme_to_templates exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'apply_room_theme_to_templates' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- Create the function if it doesn't exist
    CREATE FUNCTION public.apply_room_theme_to_templates(p_room_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      -- Get the room theme
      UPDATE activations
      SET theme = (SELECT theme FROM rooms WHERE id = p_room_id)
      WHERE room_id = p_room_id AND is_template = true;
    END;
    $$;
  END IF;
END
$$;

-- Add poll_votes to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;