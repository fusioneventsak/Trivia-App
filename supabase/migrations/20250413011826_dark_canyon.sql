/*
  # Add Timer Support to Activations
  
  1. New Fields
    - `time_limit` (integer): Time limit in seconds for the activation
    - `timer_started_at` (timestamp): When the timer was started
    - `show_answers` (boolean): Whether to show answers (controlled by timer)
    
  2. Description
    This migration adds support for timed activations where:
    - Admins can set a time limit for each activation
    - Answers are hidden until the timer expires
    - The system tracks when timers start and automatically reveals answers
*/

-- Add timer-related fields to activations table
ALTER TABLE activations 
ADD COLUMN IF NOT EXISTS time_limit integer,
ADD COLUMN IF NOT EXISTS timer_started_at timestamptz,
ADD COLUMN IF NOT EXISTS show_answers boolean DEFAULT true;

-- Create index for faster lookups of active timers
CREATE INDEX IF NOT EXISTS idx_activations_timer 
ON activations(time_limit, timer_started_at)
WHERE time_limit IS NOT NULL AND timer_started_at IS NOT NULL;

-- Create function to automatically update show_answers when timer expires
CREATE OR REPLACE FUNCTION check_and_update_timers()
RETURNS void AS $$
BEGIN
  -- Update show_answers for activations where timer has expired
  UPDATE activations
  SET show_answers = true
  WHERE 
    time_limit IS NOT NULL AND 
    timer_started_at IS NOT NULL AND
    show_answers = false AND
    (EXTRACT(EPOCH FROM (NOW() - timer_started_at)) >= time_limit);
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to run the timer check function
-- Note: This requires pg_cron extension which may not be available in all environments
-- As an alternative, we'll handle this in the application code
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- If pg_cron is available, create a job to run every minute
    PERFORM cron.schedule('* * * * *', 'SELECT check_and_update_timers()');
  END IF;
END $$;