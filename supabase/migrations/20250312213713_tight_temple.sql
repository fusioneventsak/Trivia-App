/*
  # Add Support for Text Answer Questions

  1. Changes
    - Add exact_answer column to activations table
    - Update type constraint to support multiple activation types
    - Allow for text_answer, poll, and social_wall types

  2. New Activation Types
    - multiple_choice: existing trivia questions with options
    - text_answer: questions where users type the exact answer
    - poll: for user voting/polling
    - social_wall: for displaying user-generated content
*/

-- Add exact_answer column to activations table
ALTER TABLE activations ADD COLUMN IF NOT EXISTS exact_answer text DEFAULT NULL;

-- Update type constraint to allow new activation types
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  BEGIN
    ALTER TABLE activations DROP CONSTRAINT IF EXISTS activations_type_check;
  EXCEPTION
    WHEN undefined_object THEN
      NULL; -- Constraint doesn't exist, ignore
  END;

  -- Create new constraint with updated activation types
  ALTER TABLE activations
    ADD CONSTRAINT activations_type_check
    CHECK (type IN ('multiple_choice', 'text_answer', 'poll', 'social_wall'));
END $$;