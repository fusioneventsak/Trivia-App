/*
  # Fix Function Search Path Security Issues
  
  1. Changes
     - Add explicit search_path parameter to all functions
     - Fix security vulnerabilities related to mutable search paths
     - Update all affected functions with proper security settings
     
  2. Security
     - Prevents potential SQL injection via search_path manipulation
     - Ensures functions always use the correct schema
     - Follows Supabase security best practices
*/

-- Fix validate_activation function
CREATE OR REPLACE FUNCTION public.validate_activation(activation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  activation record;
BEGIN
  -- Get activation details
  SELECT * INTO activation FROM public.activations WHERE id = activation_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', jsonb_build_array('Activation not found')
    );
  END IF;
  
  -- Start with empty arrays for errors and warnings
  result := jsonb_build_object(
    'valid', true,
    'errors', jsonb_build_array(),
    'warnings', jsonb_build_array()
  );
  
  -- Basic validation checks
  IF activation.question IS NULL OR length(activation.question) < 1 THEN
    result := jsonb_set(result, '{errors}', result->'errors' || '"Question is required"');
    result := jsonb_set(result, '{valid}', 'false');
  END IF;
  
  -- Type-specific validation
  CASE activation.type
    WHEN 'multiple_choice' THEN
      -- Check options
      IF activation.options IS NULL OR jsonb_array_length(activation.options) < 2 THEN
        result := jsonb_set(result, '{errors}', result->'errors' || '"Multiple choice questions require at least 2 options"');
        result := jsonb_set(result, '{valid}', 'false');
      END IF;
      
      -- Check correct answer
      IF activation.correct_answer IS NULL OR length(activation.correct_answer) < 1 THEN
        result := jsonb_set(result, '{errors}', result->'errors' || '"Correct answer is required for multiple choice questions"');
        result := jsonb_set(result, '{valid}', 'false');
      END IF;
      
    WHEN 'text_answer' THEN
      -- Check exact answer
      IF activation.exact_answer IS NULL OR length(activation.exact_answer) < 1 THEN
        result := jsonb_set(result, '{errors}', result->'errors' || '"Exact answer is required for text answer questions"');
        result := jsonb_set(result, '{valid}', 'false');
      END IF;
      
    WHEN 'poll' THEN
      -- Check options
      IF activation.options IS NULL OR jsonb_array_length(activation.options) < 2 THEN
        result := jsonb_set(result, '{errors}', result->'errors' || '"Poll questions require at least 2 options"');
        result := jsonb_set(result, '{valid}', 'false');
      END IF;
  END CASE;
  
  -- Time limit validation
  IF activation.time_limit IS NOT NULL AND activation.time_limit < 5 THEN
    result := jsonb_set(result, '{warnings}', result->'warnings' || '"Time limit less than 5 seconds may be too short"');
  END IF;
  
  -- Return validation results
  RETURN result;
END;
$$;

-- Fix check_cross_room_compatibility function
CREATE OR REPLACE FUNCTION public.check_cross_room_compatibility(activation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  activation record;
BEGIN
  -- Get activation details
  SELECT * INTO activation FROM public.activations WHERE id = activation_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'compatible', false,
      'issues', jsonb_build_array('Activation not found')
    );
  END IF;
  
  -- Start with empty arrays for issues
  result := jsonb_build_object(
    'compatible', true,
    'issues', jsonb_build_array(),
    'compatible_rooms', jsonb_build_array()
  );
  
  -- Check for media resource compatibility
  IF activation.media_type <> 'none' AND activation.media_url IS NOT NULL THEN
    -- Add a warning if media is used (might not be available in all contexts)
    result := jsonb_set(result, '{issues}', result->'issues' || '"Media resources may require additional bandwidth"');
  END IF;
  
  -- Find compatible rooms
  FOR activation.room_id IN (
    SELECT id FROM public.rooms
  ) LOOP
    -- Add room to compatible list
    result := jsonb_set(
      result, 
      '{compatible_rooms}', 
      result->'compatible_rooms' || to_jsonb(activation.room_id)
    );
  END LOOP;
  
  -- Return compatibility results
  RETURN result;
END;
$$;

-- Fix get_poll_votes function
CREATE OR REPLACE FUNCTION public.get_poll_votes(activation_id UUID)
RETURNS TABLE (answer TEXT, vote_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.option_text, 
    COUNT(pv.id)::BIGINT AS vote_count
  FROM 
    public.poll_votes pv
  WHERE 
    pv.activation_id = get_poll_votes.activation_id
  GROUP BY 
    pv.option_text
  ORDER BY 
    vote_count DESC;
END;
$$;

-- Fix has_player_voted function
CREATE OR REPLACE FUNCTION public.has_player_voted(activation_id UUID, player_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vote_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.poll_votes
    WHERE activation_id = has_player_voted.activation_id
    AND player_id = has_player_voted.player_id
  ) INTO vote_exists;
  
  RETURN vote_exists;
END;
$$;

-- Fix update_room_theme function
CREATE OR REPLACE FUNCTION public.update_room_theme(
  p_room_id uuid,
  p_primary_color text,
  p_secondary_color text,
  p_background_color text,
  p_text_color text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update room theme
  UPDATE public.rooms
  SET theme = jsonb_build_object(
    'primary_color', p_primary_color,
    'secondary_color', p_secondary_color,
    'background_color', p_background_color,
    'text_color', p_text_color
  )
  WHERE id = p_room_id;
  
  RETURN FOUND;
END;
$$;

-- Fix set_room_code function
CREATE OR REPLACE FUNCTION public.set_room_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Only set room_code if it's NULL
  IF NEW.room_code IS NULL THEN
    LOOP
      -- Generate a 4-character alphanumeric code (uppercase)
      new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
      
      -- Check if this code already exists
      SELECT EXISTS(
        SELECT 1 FROM public.rooms WHERE room_code = new_code
      ) INTO code_exists;
      
      -- If code doesn't exist, use it
      IF NOT code_exists THEN
        NEW.room_code := new_code;
        EXIT;
      END IF;
    END LOOP;
  ELSE
    -- If a room_code was provided, ensure it's exactly 4 characters
    IF LENGTH(NEW.room_code) != 4 THEN
      RAISE EXCEPTION 'Room code must be exactly 4 characters';
    END IF;
    
    -- Convert to uppercase
    NEW.room_code := UPPER(NEW.room_code);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix fix_player_stats function
CREATE OR REPLACE FUNCTION public.fix_player_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fix missing stats
  UPDATE public.players 
  SET stats = jsonb_build_object(
    'totalPoints', score,
    'correctAnswers', 0,
    'totalAnswers', 0,
    'averageResponseTimeMs', 0
  )
  WHERE stats IS NULL;
  
  -- Fix inconsistencies between score and totalPoints
  UPDATE public.players
  SET 
    stats = jsonb_set(
      stats,
      '{totalPoints}',
      to_jsonb(score),
      true
    )
  WHERE stats->>'totalPoints' IS NULL OR (stats->>'totalPoints')::numeric != score;
  
  -- Fix missing properties in stats
  UPDATE public.players
  SET stats = jsonb_build_object(
    'totalPoints', COALESCE((stats->>'totalPoints')::numeric, score),
    'correctAnswers', COALESCE((stats->>'correctAnswers')::numeric, 0),
    'totalAnswers', COALESCE((stats->>'totalAnswers')::numeric, 0),
    'averageResponseTimeMs', COALESCE((stats->>'averageResponseTimeMs')::numeric, 0)
  )
  WHERE 
    stats->>'correctAnswers' IS NULL OR
    stats->>'totalAnswers' IS NULL OR
    stats->>'averageResponseTimeMs' IS NULL;
END;
$$;

-- Fix generate_option_ids function
CREATE OR REPLACE FUNCTION public.generate_option_ids()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
  new_options JSONB[];
BEGIN
  -- Only process if options exist and type is poll or multiple_choice
  IF NEW.options IS NOT NULL AND jsonb_array_length(NEW.options) > 0 AND 
     (NEW.type = 'poll' OR NEW.type = 'multiple_choice') THEN
    
    -- Reset the array
    new_options := ARRAY[]::JSONB[];
    
    -- Loop through each option and add an ID if it doesn't have one
    FOR i IN 0..jsonb_array_length(NEW.options) - 1 LOOP
      IF NEW.options->i->>'id' IS NULL THEN
        new_options := array_append(new_options, 
          NEW.options->i || jsonb_build_object('id', gen_random_uuid()::text)
        );
      ELSE
        new_options := array_append(new_options, NEW.options->i);
      END IF;
    END LOOP;
    
    -- Convert array back to JSONB
    NEW.options := to_jsonb(new_options);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    COALESCE(auth.jwt() ->> 'email', '') = 'info@fusion-events.ca'
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    );
$$;

-- Fix check_options_format function
CREATE OR REPLACE FUNCTION public.check_options_format(options jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  element jsonb;
  valid_types text[] := ARRAY['none', 'image', 'gif'];
BEGIN
  -- Check if it's an array
  IF jsonb_typeof(options) != 'array' THEN
    RETURN false;
  END IF;

  -- Check each element using jsonb_array_elements
  FOR element IN 
    SELECT value FROM jsonb_array_elements(options)
  LOOP
    -- Check if element is an object
    IF jsonb_typeof(element) != 'object' THEN
      RETURN false;
    END IF;

    -- Check required fields exist
    IF NOT (
      element ? 'text' AND
      element ? 'media_type' AND
      element ? 'media_url'
    ) THEN
      RETURN false;
    END IF;

    -- Check media_type is valid
    IF NOT (element->>'media_type' = ANY(valid_types)) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;