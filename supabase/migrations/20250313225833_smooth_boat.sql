/*
  # Activation Management System

  1. New Fields
    - Add time_limit and rewards fields to activations table
    - Add metadata field for storing additional configuration settings

  2. Test Logs
    - Add activation_tests table to store test results and reports
    - Add performance metrics

  3. Enhanced Functions
    - Helper functions for validation and cross-room compatibility tests
*/

-- Add new fields to activations table for enhanced management
ALTER TABLE public.activations
ADD COLUMN IF NOT EXISTS time_limit integer,
ADD COLUMN IF NOT EXISTS rewards jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create a new table for storing activation test results
CREATE TABLE IF NOT EXISTS public.activation_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_id uuid REFERENCES public.activations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  test_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  performance_metrics jsonb DEFAULT '{}'::jsonb,
  compatibility_results jsonb DEFAULT '{}'::jsonb,
  test_date timestamptz DEFAULT now(),
  test_status text NOT NULL DEFAULT 'pending',
  error_logs text
);

-- Add RLS policies
ALTER TABLE public.activation_tests ENABLE ROW LEVEL SECURITY;

-- Users can view test results for their own rooms
CREATE POLICY "Users can view test results for their rooms"
ON public.activation_tests
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM activations a
    JOIN rooms r ON a.room_id = r.id
    WHERE a.id = activation_tests.activation_id
    AND r.owner_id = auth.uid()
  )) OR
  is_admin()
);

-- Users can create test results for their own rooms
CREATE POLICY "Users can create test results for their rooms"
ON public.activation_tests
FOR INSERT
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM activations a
    JOIN rooms r ON a.room_id = r.id
    WHERE a.id = activation_tests.activation_id
    AND r.owner_id = auth.uid()
  )) OR
  is_admin()
);

-- Create validation function to check activation configuration
CREATE OR REPLACE FUNCTION public.validate_activation(activation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create function to check cross-room compatibility
CREATE OR REPLACE FUNCTION public.check_cross_room_compatibility(activation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_activation_tests_activation ON public.activation_tests(activation_id);
CREATE INDEX IF NOT EXISTS idx_activation_tests_date ON public.activation_tests(test_date);