/*
  # Add error handling for poll votes

  1. New Functions
    - `handle_poll_vote_error` - Function to log errors when poll votes fail
    - `retry_failed_poll_votes` - Function to retry failed poll votes

  2. New Table
    - `poll_vote_errors` - Table to track failed poll votes for retry

  3. Security
    - Enable RLS on the new table
    - Add policies for admin access and public read access
*/

-- Create table to track failed poll votes
CREATE TABLE IF NOT EXISTS poll_vote_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_id UUID NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  option_id TEXT,
  option_text TEXT,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_retry TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE poll_vote_errors ENABLE ROW LEVEL SECURITY;

-- Create policies for the new table
CREATE POLICY "Admin can manage poll vote errors" 
ON poll_vote_errors
FOR ALL 
TO authenticated
USING (is_admin());

CREATE POLICY "Public can view poll vote errors" 
ON poll_vote_errors
FOR SELECT 
TO public
USING (true);

-- Create function to handle poll vote errors
CREATE OR REPLACE FUNCTION handle_poll_vote_error()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the error in the poll_vote_errors table
  INSERT INTO poll_vote_errors (
    activation_id,
    player_id,
    option_id,
    option_text,
    error_message
  ) VALUES (
    NEW.activation_id,
    NEW.player_id,
    NEW.option_id,
    NEW.option_text,
    'Failed to submit poll vote'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to retry failed poll votes
CREATE OR REPLACE FUNCTION retry_failed_poll_votes()
RETURNS SETOF poll_vote_errors AS $$
DECLARE
  error_record poll_vote_errors;
  success BOOLEAN;
BEGIN
  -- Get failed poll votes with retry count < 3
  FOR error_record IN 
    SELECT * FROM poll_vote_errors 
    WHERE retry_count < 3
    ORDER BY last_retry ASC
    LIMIT 10
  LOOP
    -- Try to insert the poll vote
    BEGIN
      INSERT INTO poll_votes (
        activation_id,
        player_id,
        option_id,
        option_text
      ) VALUES (
        error_record.activation_id,
        error_record.player_id,
        error_record.option_id,
        error_record.option_text
      );
      
      -- If successful, delete the error record
      DELETE FROM poll_vote_errors WHERE id = error_record.id;
      success := TRUE;
    EXCEPTION WHEN OTHERS THEN
      -- Update retry count and last retry time
      UPDATE poll_vote_errors 
      SET 
        retry_count = retry_count + 1,
        last_retry = now(),
        error_message = SQLERRM
      WHERE id = error_record.id;
      
      success := FALSE;
    END;
    
    -- Return the record with updated status
    error_record.retry_count := error_record.retry_count + 1;
    error_record.last_retry := now();
    RETURN NEXT error_record;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_poll_vote_errors_retry 
ON poll_vote_errors(retry_count, last_retry);

-- Create index for activation_id and player_id
CREATE INDEX IF NOT EXISTS idx_poll_vote_errors_activation_player
ON poll_vote_errors(activation_id, player_id);