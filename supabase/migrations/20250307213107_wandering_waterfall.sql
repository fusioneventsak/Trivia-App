/*
  # Fix RLS policies for activations table

  1. Security Changes
    - Drop existing policies to start fresh
    - Create new policies with correct permissions:
      - Authenticated users can perform all operations
      - Public users can only read activations
    
  Note: This ensures proper access control for the activations table
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to manage activations" ON activations;
DROP POLICY IF EXISTS "Allow public read access to activations" ON activations;

-- Enable RLS
ALTER TABLE activations ENABLE ROW LEVEL SECURITY;

-- Create new policy for authenticated users (all operations)
CREATE POLICY "Enable all operations for authenticated users"
  ON activations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new policy for public read access
CREATE POLICY "Enable read access for all users"
  ON activations
  FOR SELECT
  TO public
  USING (true);