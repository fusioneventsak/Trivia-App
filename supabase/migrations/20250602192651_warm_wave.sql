/*
  # Add option_id to poll_votes table

  1. New Columns
    - Add `option_id` column to `poll_votes` table to track votes by specific option ID
    - Rename existing `answer` column to `option_text` for clarity
  
  2. Changes
    - Update existing poll votes to use option_id where possible
    - Add function to generate option IDs for activations
  
  3. Security
    - Maintain existing RLS policies
*/

-- Add option_id column to poll_votes table
ALTER TABLE poll_votes 
ADD COLUMN IF NOT EXISTS option_id TEXT;

-- Rename answer column to option_text for clarity
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'poll_votes' AND column_name = 'answer'
  ) THEN
    ALTER TABLE poll_votes RENAME COLUMN answer TO option_text;
  END IF;
END $$;

-- Create function to ensure options have IDs
CREATE OR REPLACE FUNCTION generate_option_ids()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for new activations
DROP TRIGGER IF EXISTS ensure_option_ids ON activations;
CREATE TRIGGER ensure_option_ids
  BEFORE INSERT OR UPDATE ON activations
  FOR EACH ROW
  EXECUTE FUNCTION generate_option_ids();

-- Update existing activations to have option IDs
UPDATE activations 
SET options = options -- This will trigger the function
WHERE type IN ('poll', 'multiple_choice') 
  AND options IS NOT NULL;

-- Create function to migrate existing poll votes to use option_id
CREATE OR REPLACE FUNCTION migrate_poll_votes_to_option_id()
RETURNS void AS $$
DECLARE
  vote_record RECORD;
  activation_record RECORD;
  option_record RECORD;
  option_id TEXT;
BEGIN
  -- Loop through all poll votes that don't have an option_id
  FOR vote_record IN 
    SELECT pv.id, pv.activation_id, pv.option_text 
    FROM poll_votes pv 
    WHERE pv.option_id IS NULL
  LOOP
    -- Get the activation for this vote
    SELECT * INTO activation_record 
    FROM activations 
    WHERE id = vote_record.activation_id;
    
    -- Skip if activation not found or has no options
    CONTINUE WHEN activation_record IS NULL OR 
               activation_record.options IS NULL OR 
               jsonb_array_length(activation_record.options) = 0;
    
    -- Find the option that matches the text
    option_id := NULL;
    
    -- Loop through options to find matching text
    FOR i IN 0..jsonb_array_length(activation_record.options) - 1 LOOP
      IF activation_record.options->i->>'text' = vote_record.option_text THEN
        option_id := activation_record.options->i->>'id';
        EXIT;
      END IF;
    END LOOP;
    
    -- Update the vote with the option_id if found
    IF option_id IS NOT NULL THEN
      UPDATE poll_votes 
      SET option_id = option_id
      WHERE id = vote_record.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the migration function
SELECT migrate_poll_votes_to_option_id();

-- Drop the migration function as it's no longer needed
DROP FUNCTION migrate_poll_votes_to_option_id();