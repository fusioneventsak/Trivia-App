/*
  # Fix Activation Templates

  1. Changes
    - Add missing columns for templates
    - Update constraints and indexes
    - Fix RLS policies for template access
    
  2. Description
    This migration adds proper support for activation templates
    including metadata fields and access controls.
*/

-- Add template-specific fields if they don't exist
ALTER TABLE activations
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS difficulty text,
ADD COLUMN IF NOT EXISTS tags text[],
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

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

-- Drop existing RLS policies
DROP POLICY IF EXISTS "enable_public_access" ON activations;

-- Create new RLS policies for templates
CREATE POLICY "users_manage_templates"
ON activations
FOR ALL
TO authenticated
USING (
  -- Users can manage templates in their rooms
  (is_template = true AND EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = activations.room_id
    AND rooms.owner_id = auth.uid()
  ))
  OR
  -- Users can manage their own activations
  (is_template = false AND EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = activations.room_id
    AND rooms.owner_id = auth.uid()
  ))
);

-- Allow public to view active templates
CREATE POLICY "public_view_templates"
ON activations
FOR SELECT
TO public
USING (
  is_template = false OR
  (is_template = true AND is_public = true)
);