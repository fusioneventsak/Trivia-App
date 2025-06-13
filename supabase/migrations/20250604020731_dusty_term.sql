/*
  # Add option_id and option_text columns to poll_votes table
  
  1. New Columns
    - Add option_id TEXT column to poll_votes table if it doesn't exist
    - Add option_text TEXT column to poll_votes table if it doesn't exist
  
  2. Purpose
    - These columns store the selected option's ID and text when a user votes in a poll
    - Enables better tracking and analysis of poll results
    - Supports the usePollManager hook for real-time poll functionality
*/

-- Check if option_id and option_text columns exist
-- If not, add them:
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS option_id TEXT,
ADD COLUMN IF NOT EXISTS option_text TEXT;

-- Create an index on option_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON poll_votes(option_id);

-- Create an index on option_text for faster lookups
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_text ON poll_votes(option_text);

-- Update existing poll votes to set option_text from the options in activations
-- This is a best-effort migration for existing data
DO $$
DECLARE
  vote record;
  activation record;
  option_text text;
  i integer;
  option_obj jsonb;
BEGIN
  -- Process votes that have option_id but no option_text
  FOR vote IN 
    SELECT pv.id, pv.activation_id, pv.option_id 
    FROM poll_votes pv
    WHERE pv.option_id IS NOT NULL AND pv.option_text IS NULL
  LOOP
    -- Get the activation
    SELECT * INTO activation FROM activations WHERE id = vote.activation_id;
    
    -- If activation has options, try to find matching option
    IF activation.options IS NOT NULL AND jsonb_array_length(activation.options) > 0 THEN
      option_text := NULL;
      
      -- Look through options to find matching ID
      FOR i IN 0..jsonb_array_length(activation.options) - 1 LOOP
        option_obj := activation.options->i;
        IF option_obj->>'id' = vote.option_id THEN
          option_text := option_obj->>'text';
          EXIT;
        END IF;
      END LOOP;
      
      -- Update the vote with the option text if found
      IF option_text IS NOT NULL THEN
        UPDATE poll_votes SET option_text = option_text WHERE id = vote.id;
      END IF;
    END IF;
  END LOOP;
END
$$;