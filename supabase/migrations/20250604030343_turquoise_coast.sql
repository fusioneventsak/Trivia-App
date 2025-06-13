/*
  # Add indexes to poll_votes table
  
  1. New Indexes
    - Add index on activation_id for faster poll vote queries
    - Add index on option_id for faster option-based queries
    - Add index on option_text for faster text-based queries
    - Add index on player_id for faster player-based queries
    - Add combined index on activation_id and player_id for uniqueness checks
*/

-- Add indexes to poll_votes table for better performance
CREATE INDEX IF NOT EXISTS idx_poll_votes_activation ON poll_votes(activation_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON poll_votes(option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_text ON poll_votes(option_text);
CREATE INDEX IF NOT EXISTS idx_poll_votes_player ON poll_votes(player_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_activation_player ON poll_votes(activation_id, player_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_activation_id ON poll_votes(activation_id);