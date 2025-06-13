/*
  # Fix for Room Activations Foreign Key Issue
  
  1. Schema Updates
    - Update NULL room_id values before setting NOT NULL constraint
    - Ensure proper foreign key cascade behavior
*/

-- First, handle existing NULL room_id values by either:
-- 1. Giving them a valid room_id (preferred)
-- 2. Deleting those rows (if they're not needed)

-- Option 1: Update NULL room_ids with a valid room_id value
-- Get the first available room_id to use as default
DO $$
DECLARE
  default_room_id uuid;
BEGIN
  -- Get the first room to use as a default
  SELECT id INTO default_room_id FROM rooms LIMIT 1;
  
  -- Only proceed if we have a default room
  IF default_room_id IS NOT NULL THEN
    -- Update activations with NULL room_id
    UPDATE activations 
    SET room_id = default_room_id
    WHERE room_id IS NULL;
  ELSE
    -- If no default room is available, we'll delete the NULL room_id entries instead
    DELETE FROM activations WHERE room_id IS NULL;
  END IF;
END $$;

-- Alternative Option 2: Simply delete activations with NULL room_id
-- Uncomment this if you want to delete instead of update
-- DELETE FROM activations WHERE room_id IS NULL;

-- First check if the constraint already exists and drop it if it does
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activations_room_id_fkey'
    AND table_name = 'activations'
  ) THEN
    ALTER TABLE activations DROP CONSTRAINT activations_room_id_fkey;
  END IF;
END $$;

-- Now add the NOT NULL constraint, but only once we've handled NULL values
ALTER TABLE activations ALTER COLUMN room_id SET NOT NULL;

-- Re-add the foreign key with ON DELETE CASCADE
ALTER TABLE activations
  ADD CONSTRAINT activations_room_id_fkey
  FOREIGN KEY (room_id)
  REFERENCES rooms(id)
  ON DELETE CASCADE;

-- Add an index on room_id for better performance
CREATE INDEX IF NOT EXISTS idx_activations_room
ON activations(room_id);