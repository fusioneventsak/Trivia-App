/*
  # Update Players Table RLS Policies

  1. Changes
    - Allow public users to insert into players table
    - Maintain existing read access
    - Update policy for score updates

  2. Security
    - Public can create new players
    - Public can read all players
    - Only authenticated users can update scores
*/

-- Drop existing policies for players table
DROP POLICY IF EXISTS "Allow public read access to players" ON players;
DROP POLICY IF EXISTS "Allow authenticated users to insert players" ON players;
DROP POLICY IF EXISTS "Allow authenticated users to update player scores" ON players;

-- Create new policies
CREATE POLICY "Allow public read access to players"
  ON players
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public to insert players"
  ON players
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update player scores"
  ON players
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);