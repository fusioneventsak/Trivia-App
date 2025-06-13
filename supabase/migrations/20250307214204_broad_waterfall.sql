/*
  # Fix Activations Table RLS

  1. Security Changes
    - Enable RLS on activations table
    - Add policies for public access to activations
    - Allow anyone to insert and read activations
*/

ALTER TABLE activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public to insert activations"
ON activations FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public to read activations"
ON activations FOR SELECT
TO public
USING (true);