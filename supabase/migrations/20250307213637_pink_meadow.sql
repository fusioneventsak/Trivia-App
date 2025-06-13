/*
  # Enable public access to activations

  1. Security Changes
    - Drop existing policies
    - Create new public access policies
    - Allow unrestricted access to activations table
    
  Note: This configuration allows anyone with access to the admin page to manage activations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "authenticated_full_access" ON activations;
DROP POLICY IF EXISTS "public_read_access" ON activations;

-- Create new public access policy
CREATE POLICY "enable_public_access"
  ON activations
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);