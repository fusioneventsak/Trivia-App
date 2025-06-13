/*
  # Add poll votes policies

  1. New Policies
    - Enable RLS on poll_votes table
    - Add policy for public read access to poll votes
    - Add policy for public insert access to poll votes
*/

-- Enable RLS on poll_votes table
ALTER TABLE IF EXISTS public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors
DROP POLICY IF EXISTS "Poll votes are viewable by everyone" ON poll_votes;
DROP POLICY IF EXISTS "Players can insert their own votes" ON poll_votes;

-- Create policy for public read access to poll votes
CREATE POLICY "Poll votes are viewable by everyone" 
ON poll_votes
FOR SELECT 
TO public
USING (true);

-- Create policy for public insert access to poll votes
CREATE POLICY "Players can insert their own votes" 
ON poll_votes
FOR INSERT 
TO public
WITH CHECK (true);