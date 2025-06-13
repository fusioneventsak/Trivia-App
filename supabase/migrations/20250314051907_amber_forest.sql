/*
  # Add Room Codes
  
  1. Changes
    - Add room_code column to rooms table
    - Add unique constraint on room_code
    - Add function to generate random 4-digit codes
    - Add trigger to auto-generate codes for new rooms
    
  2. Description
    This adds support for 4-digit room codes that can be used for:
    - Quick room access via URL (e.g., ak/admin/1234)
    - Mobile app joining
    - Easy room sharing
*/

-- Add room_code column
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS room_code text;

-- Add unique constraint
ALTER TABLE rooms
ADD CONSTRAINT unique_room_code UNIQUE (room_code);

-- Create function to generate random room code
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS text AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    -- Generate a random 4-digit number
    new_code := lpad(floor(random() * 9000 + 1000)::text, 4, '0');
    
    -- Check if code already exists
    SELECT EXISTS (
      SELECT 1 FROM rooms WHERE room_code = new_code
    ) INTO code_exists;
    
    -- Exit loop if we found a unique code
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically generate room codes
CREATE OR REPLACE FUNCTION set_room_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set room_code if it's not already set
  IF NEW.room_code IS NULL THEN
    NEW.room_code := generate_room_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to rooms table
DROP TRIGGER IF EXISTS ensure_room_code ON rooms;
CREATE TRIGGER ensure_room_code
  BEFORE INSERT ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION set_room_code();

-- Generate codes for existing rooms
UPDATE rooms 
SET room_code = generate_room_code() 
WHERE room_code IS NULL;