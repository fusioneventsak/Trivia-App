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

-- Fix any malformed stats objects
UPDATE players
SET stats = jsonb_build_object(
  'totalPoints', COALESCE((stats->>'totalPoints')::numeric, score, 0),
  'correctAnswers', COALESCE((stats->>'correctAnswers')::numeric, 0),
  'totalAnswers', COALESCE((stats->>'totalAnswers')::numeric, 0),
  'averageResponseTimeMs', COALESCE((stats->>'averageResponseTimeMs')::numeric, 0)
)
WHERE 
  stats IS NOT NULL AND 
  (
    stats->>'totalPoints' IS NULL OR
    stats->>'correctAnswers' IS NULL OR
    stats->>'totalAnswers' IS NULL OR
    stats->>'averageResponseTimeMs' IS NULL
  );

-- Make sure score is always an integer to avoid type errors
UPDATE players 
SET score = ROUND(score::numeric)
WHERE score != ROUND(score::numeric);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS players_stats_gin_idx ON players USING gin(stats);

-- Add index for faster leaderboard queries
CREATE INDEX IF NOT EXISTS idx_players_score ON players(score DESC);

-- Create stored procedure to fix player stats
CREATE OR REPLACE FUNCTION fix_player_stats()
RETURNS void AS $$
BEGIN
  -- Fix missing stats
  UPDATE players 
  SET stats = jsonb_build_object(
    'totalPoints', score,
    'correctAnswers', 0,
    'totalAnswers', 0,
    'averageResponseTimeMs', 0
  )
  WHERE stats IS NULL;
  
  -- Fix inconsistencies between score and totalPoints
  UPDATE players
  SET 
    stats = jsonb_set(
      stats,
      '{totalPoints}',
      to_jsonb(score),
      true
    )
  WHERE stats->>'totalPoints' IS NULL OR (stats->>'totalPoints')::numeric != score;
  
  -- Fix missing properties in stats
  UPDATE players
  SET stats = jsonb_build_object(
    'totalPoints', COALESCE((stats->>'totalPoints')::numeric, score),
    'correctAnswers', COALESCE((stats->>'correctAnswers')::numeric, 0),
    'totalAnswers', COALESCE((stats->>'totalAnswers')::numeric, 0),
    'averageResponseTimeMs', COALESCE((stats->>'averageResponseTimeMs')::numeric, 0)
  )
  WHERE 
    stats->>'correctAnswers' IS NULL OR
    stats->>'totalAnswers' IS NULL OR
    stats->>'averageResponseTimeMs' IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Run the fix immediately
SELECT fix_player_stats();