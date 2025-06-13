/*
  # Fix Player Stats for All Rooms
  
  1. Changes
    - Ensure all players have a properly initialized stats column
    - Update stats for players with incorrect values
    - Add index for better performance on stats queries
    
  2. Description
    This migration ensures that all player stats are properly initialized
    and indexed for better performance, fixing issues with point distribution.
*/

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

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS players_stats_gin_idx ON players USING gin(stats);

-- Add index for faster leaderboard queries
CREATE INDEX IF NOT EXISTS idx_players_score ON players(score DESC);