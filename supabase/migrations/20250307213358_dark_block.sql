/*
  # Fix RLS policies for activations table

  1. Security Changes
    - Drop all existing policies
    - Create new policies with proper permissions for authenticated and public users
    - Ensure proper WITH CHECK clauses for INSERT and UPDATE operations
    
  Note: This ensures proper access control while maintaining data integrity
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Enable read for authenticated users" ON activations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON activations;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON activations;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON activations;
DROP POLICY IF EXISTS "Enable read for public users" ON activations;

-- Create new policies with proper permissions
CREATE POLICY "Enable read for authenticated users"
  ON activations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON activations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for authenticated users"
  ON activations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable delete for authenticated users"
  ON activations
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Public read access only for non-template activations
CREATE POLICY "Enable read for public users"
  ON activations
  FOR SELECT
  TO public
  USING (NOT is_template OR is_template IS NULL);