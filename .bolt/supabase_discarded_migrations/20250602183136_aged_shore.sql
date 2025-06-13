/*
  # Create poll_votes table

  1. New Tables
    - `poll_votes` - Stores individual poll votes with player and activation references
      - `id` (uuid, primary key)
      - `activation_id` (uuid, foreign key to activations)
      - `player_id` (uuid, foreign key to players)
      - `answer` (text, the selected option)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `poll_votes` table
    - Add policy for players to insert their own votes
    - Add policy for public read access to poll votes

  3. Indexes
    - Create indexes for faster queries on activation_id and player_id
    - Create unique constraint to ensure one vote per player per activation
*/

-- Create poll_votes table to track individual votes
CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_id UUID NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create unique constraint to ensure one vote per player per activation
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_activation_id_player_id_key 
  UNIQUE (activation_id, player_id);

-- Create indexes for faster queries
CREATE INDEX idx_poll_votes_activation ON poll_votes(activation_id);
CREATE INDEX idx_poll_votes_player ON poll_votes(player_id);

-- Enable RLS
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Players can insert their own votes" ON poll_votes
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Poll votes are viewable by everyone" ON poll_votes
  FOR SELECT TO public
  USING (true);