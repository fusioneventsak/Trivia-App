/*
  # Ensure 4-character room codes
  
  1. Changes
     - Updates existing rooms to have exactly 4-character codes
     - Improves room code generation function
     - Adds constraint to ensure room codes are always 4 characters
     
  2. Security
     - No security changes
*/

-- First, update any existing rooms that have codes that aren't exactly 4 characters
UPDATE rooms
SET room_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4))
WHERE room_code IS NULL OR LENGTH(room_code) != 4;

-- Drop the existing trigger first to avoid dependency issues
DROP TRIGGER IF EXISTS ensure_room_code ON rooms;

-- Then drop and recreate the function
DROP FUNCTION IF EXISTS set_room_code() CASCADE;

-- Create an improved function that ensures 4-digit codes
CREATE OR REPLACE FUNCTION set_room_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Only set room_code if it's NULL
  IF NEW.room_code IS NULL THEN
    LOOP
      -- Generate a 4-character alphanumeric code (uppercase)
      new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
      
      -- Check if this code already exists
      SELECT EXISTS(
        SELECT 1 FROM rooms WHERE room_code = new_code
      ) INTO code_exists;
      
      -- If code doesn't exist, use it
      IF NOT code_exists THEN
        NEW.room_code := new_code;
        EXIT;
      END IF;
    END LOOP;
  ELSE
    -- If a room_code was provided, ensure it's exactly 4 characters
    IF LENGTH(NEW.room_code) != 4 THEN
      RAISE EXCEPTION 'Room code must be exactly 4 characters';
    END IF;
    
    -- Convert to uppercase
    NEW.room_code := UPPER(NEW.room_code);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER ensure_room_code
BEFORE INSERT ON rooms
FOR EACH ROW
EXECUTE FUNCTION set_room_code();

-- Add a constraint to ensure room_code is always 4 characters
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS room_code_length_check;
ALTER TABLE rooms ADD CONSTRAINT room_code_length_check 
  CHECK (room_code IS NULL OR LENGTH(room_code) = 4);