-- Add player_name column to analytics_events table if it doesn't exist
ALTER TABLE analytics_events 
ADD COLUMN IF NOT EXISTS player_name text;

-- Create index for faster lookups by player_name
CREATE INDEX IF NOT EXISTS idx_analytics_events_player_name
ON analytics_events(player_name) WHERE player_name IS NOT NULL;