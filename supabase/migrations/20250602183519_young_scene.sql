-- Create poll_votes table to track individual votes
CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_id UUID NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Check if constraint exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'poll_votes_activation_id_player_id_key'
  ) THEN
    ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_activation_id_player_id_key 
      UNIQUE (activation_id, player_id);
  END IF;
END $$;

-- Create indexes for faster queries (IF NOT EXISTS added to prevent errors)
CREATE INDEX IF NOT EXISTS idx_poll_votes_activation ON poll_votes(activation_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_player ON poll_votes(player_id);

-- Enable RLS (this is idempotent so no need for IF NOT EXISTS)
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to avoid errors on recreation
DROP POLICY IF EXISTS "Players can insert their own votes" ON poll_votes;
DROP POLICY IF EXISTS "Poll votes are viewable by everyone" ON poll_votes;

-- Create policies
CREATE POLICY "Players can insert their own votes" ON poll_votes
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Poll votes are viewable by everyone" ON poll_votes
  FOR SELECT TO public
  USING (true);