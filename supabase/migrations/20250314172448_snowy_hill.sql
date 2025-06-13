/*
  # Fix Activation Templates

  1. Changes
    - Add missing columns for templates
    - Add proper constraints
    - Create indexes for better performance
    
  2. Description
    This migration fixes issues with template creation and management
*/

-- Add title field if it doesn't exist
ALTER TABLE activations 
ADD COLUMN IF NOT EXISTS title text;

-- Add description field if it doesn't exist
ALTER TABLE activations
ADD COLUMN IF NOT EXISTS description text;

-- Add template-specific fields if they don't exist
ALTER TABLE activations
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS difficulty text,
ADD COLUMN IF NOT EXISTS tags text[];

-- Add constraint for difficulty values
ALTER TABLE activations
DROP CONSTRAINT IF EXISTS activations_difficulty_check;

ALTER TABLE activations
ADD CONSTRAINT activations_difficulty_check
CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard'));

-- Create index for template lookups
CREATE INDEX IF NOT EXISTS idx_activations_templates
ON activations(room_id, is_template);

-- Create index for template categories
CREATE INDEX IF NOT EXISTS idx_activations_category
ON activations(category) WHERE category IS NOT NULL;

-- Create index for template difficulty
CREATE INDEX IF NOT EXISTS idx_activations_difficulty
ON activations(difficulty) WHERE difficulty IS NOT NULL;