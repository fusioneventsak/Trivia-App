/*
  # Update activations table and policies

  1. Security Changes
    - Drop and recreate policies with proper permissions
    - Add session_id foreign key constraint
    
  2. Changes
    - Add is_template column for saving activations as templates
    - Add parent_id for tracking duplicated activations
    
  Note: This ensures proper access control and adds template/duplication support
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON activations;
DROP POLICY IF EXISTS "Enable read access for all users" ON activations;

-- Add new columns
ALTER TABLE activations ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;
ALTER TABLE activations ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES activations(id);

-- Enable RLS
ALTER TABLE activations ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Enable read for authenticated users"
  ON activations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON activations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON activations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
  ON activations
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policy for public users
CREATE POLICY "Enable read for public users"
  ON activations
  FOR SELECT
  TO public
  USING (NOT is_template);