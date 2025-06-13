-- Add stats column to players table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'stats'
  ) THEN
    ALTER TABLE players 
    ADD COLUMN stats JSONB DEFAULT jsonb_build_object(
      'totalPoints', 0,
      'correctAnswers', 0,
      'totalAnswers', 0,
      'averageResponseTimeMs', 0
    );
  END IF;
END $$;

-- Initialize stats for existing players that have null stats
UPDATE players 
SET stats = jsonb_build_object(
  'totalPoints', score, -- Use existing score for totalPoints
  'correctAnswers', 0,
  'totalAnswers', 0,
  'averageResponseTimeMs', 0
)
WHERE stats IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS players_stats_gin_idx ON players USING gin(stats);