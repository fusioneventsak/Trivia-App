/*
  # Timer Consistency Migration
  
  1. New Functions
    - `check_timer_expired` - Checks if a timer has expired based on server time
    - `get_remaining_time` - Calculates remaining time for an activation timer
    
  2. New Columns
    - `updated_at` - Added to activations table to track when records are modified
    
  3. New Triggers
    - Automatic `updated_at` maintenance for activations
    
  4. New Indexes
    - Index on timer fields for faster queries
    
  5. Purpose
    This migration adds server-side timer validation to ensure consistency
    across multiple app instances, preventing timing discrepancies between
    different clients.
*/

-- Add a function to check if timer has expired
CREATE OR REPLACE FUNCTION check_timer_expired(activation_id uuid)
RETURNS boolean AS $$
DECLARE
    activation_record RECORD;
    elapsed_ms bigint;
    total_ms bigint;
BEGIN
    -- Get activation data
    SELECT time_limit, timer_started_at 
    INTO activation_record
    FROM activations 
    WHERE id = activation_id;
    
    -- If no time limit or timer not started, return false
    IF activation_record.time_limit IS NULL OR activation_record.timer_started_at IS NULL THEN
        RETURN false;
    END IF;
    
    -- Calculate elapsed time
    elapsed_ms := EXTRACT(EPOCH FROM (NOW() - activation_record.timer_started_at)) * 1000;
    total_ms := activation_record.time_limit * 1000;
    
    -- Return true if timer has expired
    RETURN elapsed_ms >= total_ms;
END;
$$ LANGUAGE plpgsql;

-- Add a function to get remaining time for an activation
CREATE OR REPLACE FUNCTION get_remaining_time(activation_id uuid)
RETURNS integer AS $$
DECLARE
    activation_record RECORD;
    elapsed_ms bigint;
    total_ms bigint;
    remaining_ms bigint;
BEGIN
    -- Get activation data
    SELECT time_limit, timer_started_at 
    INTO activation_record
    FROM activations 
    WHERE id = activation_id;
    
    -- If no time limit, return NULL
    IF activation_record.time_limit IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- If timer not started, return full time
    IF activation_record.timer_started_at IS NULL THEN
        RETURN activation_record.time_limit;
    END IF;
    
    -- Calculate remaining time
    elapsed_ms := EXTRACT(EPOCH FROM (NOW() - activation_record.timer_started_at)) * 1000;
    total_ms := activation_record.time_limit * 1000;
    remaining_ms := total_ms - elapsed_ms;
    
    -- Return remaining seconds (minimum 0)
    RETURN GREATEST(0, CEIL(remaining_ms / 1000.0)::integer);
END;
$$ LANGUAGE plpgsql;

-- Add an updated_at trigger to track when activations are modified
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at column to activations if it doesn't exist
ALTER TABLE activations ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_activations_updated_at ON activations;
CREATE TRIGGER update_activations_updated_at
    BEFORE UPDATE ON activations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add index for timer queries
CREATE INDEX IF NOT EXISTS idx_activations_timer ON activations(timer_started_at, time_limit) WHERE timer_started_at IS NOT NULL;