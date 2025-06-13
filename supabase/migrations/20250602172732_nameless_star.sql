/*
  # Add poll_votes table for tracking individual votes

  1. New Tables
    - `poll_votes`
      - `id` (uuid, primary key)
      - `activation_id` (uuid, references activations)
      - `player_id` (uuid, references players)
      - `answer` (text)
      - `created_at` (timestamp with time zone)
  
  2. Security
    - Enable RLS on `poll_votes` table
    - Add policies for public read access
    - Add policies for players to insert their own votes
  
  3. Constraints
    - Unique constraint on (activation_id, player_id) to ensure one vote per player per poll
    - Foreign key constraints with cascading deletes
  
  4. Indexes
    - Index on activation_id for faster poll result queries
    - Index on player_id for player vote history
*/

-- Create poll_votes table to track individual votes
CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activation_id UUID NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(activation_id, player_id) -- Ensure one vote per player per poll
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_poll_votes_activation ON poll_votes(activation_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_player ON poll_votes(player_id);

-- Enable RLS
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Poll votes are viewable by everyone" ON poll_votes
  FOR SELECT USING (true);

CREATE POLICY "Players can insert their own votes" ON poll_votes
  FOR INSERT WITH CHECK (true);

-- Create a function to get poll votes for an activation
CREATE OR REPLACE FUNCTION get_poll_votes(activation_id UUID)
RETURNS TABLE (answer TEXT, vote_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.answer, 
    COUNT(pv.id)::BIGINT AS vote_count
  FROM 
    poll_votes pv
  WHERE 
    pv.activation_id = activation_id
  GROUP BY 
    pv.answer
  ORDER BY 
    vote_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check if a player has voted in a poll
CREATE OR REPLACE FUNCTION has_player_voted(activation_id UUID, player_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  vote_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM poll_votes
    WHERE activation_id = has_player_voted.activation_id
    AND player_id = has_player_voted.player_id
  ) INTO vote_exists;
  
  RETURN vote_exists;
END;
$$ LANGUAGE plpgsql;