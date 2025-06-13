/*
  # Add poll votes policy

  1. New Policies
    - Add a policy to allow public read access to poll_votes table
    - Ensure poll votes are viewable by everyone

  2. Security
    - Enable RLS on poll_votes table if not already enabled
*/

-- Enable RLS on poll_votes table
ALTER TABLE IF EXISTS public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to poll votes
CREATE POLICY IF NOT EXISTS "Poll votes are viewable by everyone" 
ON poll_votes
FOR SELECT 
TO public
USING (true);

-- Create policy for public insert access to poll votes
CREATE POLICY IF NOT EXISTS "Players can insert their own votes" 
ON poll_votes
FOR INSERT 
TO public
WITH CHECK (true);