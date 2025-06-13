/*
  # Add poll result format column to activations table

  1. New Features
    - Added a `poll_result_format` column to the `activations` table that allows specifying how poll results should be displayed:
      - 'percentage': Show only percentages
      - 'votes': Show only vote counts
      - 'both': Show both percentages and vote counts (default)
    
  2. Changes
    - Updated the activations table to include the new column with a default value
    - Added a constraint to validate that poll_result_format values must be one of the allowed options
*/

-- Add poll_result_format column to activations table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'activations' AND column_name = 'poll_result_format'
  ) THEN
    ALTER TABLE activations 
    ADD COLUMN poll_result_format text DEFAULT 'both';
  END IF;
END $$;

-- Add constraint to ensure poll_result_format is one of the allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'activations' AND constraint_name = 'valid_poll_result_format'
  ) THEN
    ALTER TABLE activations
    ADD CONSTRAINT valid_poll_result_format
    CHECK (poll_result_format IS NULL OR poll_result_format IN ('percentage', 'votes', 'both'));
  END IF;
END $$;

-- Add option colors column to activations table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'activations' AND column_name = 'option_colors'
  ) THEN
    ALTER TABLE activations 
    ADD COLUMN option_colors jsonb DEFAULT NULL;
  END IF;
END $$;