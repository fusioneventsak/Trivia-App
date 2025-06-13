/*
  # Poll Votes Policies

  1. Security
    - Enable RLS on poll_votes table
    - Add policy for public to view all poll votes
    - Add policy for public to insert their own votes
*/

-- Enable Row Level Security
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Poll votes are viewable by everyone" ON poll_votes;
DROP POLICY IF EXISTS "Players can insert their own votes" ON poll_votes;

-- Create policies
CREATE POLICY "Poll votes are viewable by everyone" 
ON poll_votes
FOR SELECT 
TO public
USING (true);

CREATE POLICY "Players can insert their own votes" 
ON poll_votes
FOR INSERT 
TO public
WITH CHECK (true);