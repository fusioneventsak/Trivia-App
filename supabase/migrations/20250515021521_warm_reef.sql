/*
  # Add player_name column to analytics_events table
  
  1. Changes
    - Add player_name column to analytics_events table
    - Create index on player_name for faster lookups
    
  2. Description
    This migration helps track which player made which vote or answer,
    making it easier to detect duplicate votes and properly track player stats.
*/

-- Add player_name column to analytics_events table if it doesn't exist
ALTER TABLE analytics_events 
ADD COLUMN IF NOT EXISTS player_name text;

-- Create index for faster lookups by player_name
CREATE INDEX IF NOT EXISTS idx_analytics_events_player_name
ON analytics_events(player_name) WHERE player_name IS NOT NULL;