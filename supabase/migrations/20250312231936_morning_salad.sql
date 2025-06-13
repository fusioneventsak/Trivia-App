/*
  # Add poll state field to activations table

  1. New Fields
    - `poll_state` (text) to track poll activation state: 'pending', 'voting', 'closed'
    
  2. Description
    This migration adds a poll_state field to the activations table to control the flow
    of polls. Poll states include:
    - 'pending': Initial state when poll is activated but voting hasn't started
    - 'voting': When voting is in progress
    - 'closed': When voting has ended
*/

-- Add poll_state column to activations table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'activations' AND column_name = 'poll_state'
  ) THEN
    ALTER TABLE activations 
    ADD COLUMN poll_state text DEFAULT 'pending';
  END IF;
END $$;

-- Add constraint to ensure poll_state is one of the allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'activations' AND constraint_name = 'valid_poll_state'
  ) THEN
    ALTER TABLE activations
    ADD CONSTRAINT valid_poll_state
    CHECK (poll_state IS NULL OR poll_state IN ('pending', 'voting', 'closed'));
  END IF;
END $$;