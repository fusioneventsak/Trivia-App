/*
  # Add Leaderboard Template Type
  
  1. New Features
    - Add 'leaderboard' as a valid activation type
    - Add theme and branding fields for customization
    - Add max_players field for leaderboard display control
    
  2. Description
    This migration adds support for dedicated leaderboard templates that can be
    styled and customized with branding elements.
*/

-- Update type constraint to allow leaderboard type
ALTER TABLE activations
DROP CONSTRAINT IF EXISTS activations_type_check;

ALTER TABLE activations
ADD CONSTRAINT activations_type_check
CHECK (type IN ('multiple_choice', 'text_answer', 'poll', 'social_wall', 'leaderboard'));

-- Add theme field for storing color settings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'activations' AND column_name = 'theme'
  ) THEN
    ALTER TABLE activations 
    ADD COLUMN theme jsonb DEFAULT NULL;
  END IF;
END $$;

-- Add logo_url field for branding
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'activations' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE activations 
    ADD COLUMN logo_url text DEFAULT NULL;
  END IF;
END $$;

-- Add max_players field for leaderboard display control
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'activations' AND column_name = 'max_players'
  ) THEN
    ALTER TABLE activations 
    ADD COLUMN max_players integer DEFAULT 20;
  END IF;
END $$;