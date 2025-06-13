/*
  # Fix Poll Vote Error Handling

  1. New Tables
    - `poll_vote_errors` - Tracks failed poll votes for retry
      - `id` (uuid, primary key)
      - `activation_id` (uuid, foreign key to activations)
      - `player_id` (uuid, foreign key to players)
      - `option_id` (text, nullable)
      - `option_text` (text, nullable)
      - `error_message` (text, nullable)
      - `retry_count` (integer, default 0)
      - `created_at` (timestamptz, default now())
      - `last_retry` (timestamptz, default now())
      
  2. Security
    - Enable RLS on `poll_vote_errors` table
    - Add policies for admin management and public viewing
    
  3. Performance
    - Add indexes for faster queries on retry information and activation/player combinations
    
  4. Policies
    - Ensure poll_votes table has the right policies for public access
*/

-- Create table to track failed poll votes if it doesn't exist
CREATE TABLE IF NOT EXISTS poll_vote_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_id UUID NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  option_id TEXT,
  option_text TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_retry TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on the table
ALTER TABLE poll_vote_errors ENABLE ROW LEVEL SECURITY;

-- Create policies for the table with checks to avoid duplicates
DO $$
BEGIN
  -- Check if the admin policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'poll_vote_errors' AND policyname = 'Admin can manage poll vote errors'
  ) THEN
    -- Create the policy if it doesn't exist
    EXECUTE 'CREATE POLICY "Admin can manage poll vote errors" ON poll_vote_errors FOR ALL TO authenticated USING (is_admin())';
  END IF;
  
  -- Check if the public view policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'poll_vote_errors' AND policyname = 'Public can view poll vote errors'
  ) THEN
    -- Create the policy if it doesn't exist
    EXECUTE 'CREATE POLICY "Public can view poll vote errors" ON poll_vote_errors FOR SELECT TO public USING (true)';
  END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_poll_vote_errors_retry 
ON poll_vote_errors(retry_count, last_retry);

CREATE INDEX IF NOT EXISTS idx_poll_vote_errors_activation_player
ON poll_vote_errors(activation_id, player_id);

-- Ensure poll_votes table has the right policies
DO $$
BEGIN
  -- Check if the insert policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'poll_votes' AND policyname = 'Players can insert their own votes'
  ) THEN
    -- Create the policy if it doesn't exist
    EXECUTE 'CREATE POLICY "Players can insert their own votes" ON poll_votes FOR INSERT TO public WITH CHECK (true)';
  END IF;
  
  -- Check if the select policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'poll_votes' AND policyname = 'Poll votes are viewable by everyone'
  ) THEN
    -- Create the policy if it doesn't exist
    EXECUTE 'CREATE POLICY "Poll votes are viewable by everyone" ON poll_votes FOR SELECT TO public USING (true)';
  END IF;
END $$;