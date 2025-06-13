/*
  # Add poll display type to activations table

  1. Changes
    - Add `poll_display_type` column to activations table with default 'bar'
    
  2. Description
    This migration adds support for different poll display types in the activations table.
    The new column will store the preferred display format for poll results.
*/

-- Add poll_display_type column to activations table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'activations' AND column_name = 'poll_display_type'
  ) THEN
    ALTER TABLE activations 
    ADD COLUMN poll_display_type text DEFAULT 'bar';
  END IF;
END $$;

-- Add constraint to ensure poll_display_type is one of the allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'activations' AND constraint_name = 'valid_poll_display_type'
  ) THEN
    ALTER TABLE activations
    ADD CONSTRAINT valid_poll_display_type
    CHECK (poll_display_type IS NULL OR poll_display_type IN ('bar', 'pie', 'horizontal'));
  END IF;
END $$;