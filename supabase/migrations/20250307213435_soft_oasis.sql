/*
  # Fix activation table policies

  1. Security Changes
    - Drop existing policies
    - Create new simplified policies for authenticated users
    - Add public read access policy
    
  Note: Simplified policies to ensure proper access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read for authenticated users" ON activations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON activations;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON activations;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON activations;
DROP POLICY IF EXISTS "Enable read for public users" ON activations;
DROP POLICY IF EXISTS "Allow authenticated users to manage activations" ON activations;
DROP POLICY IF EXISTS "Allow public read access to activations" ON activations;

-- Create new simplified policies
CREATE POLICY "authenticated_full_access"
  ON activations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "public_read_access"
  ON activations
  FOR SELECT
  TO public
  USING (true);