/*
  # Simplify Room Access

  1. Changes
    - Simplify room access to be based on ownership and admin status only
    - Remove complex customer access system
    - Keep admin access for backward compatibility
    - Clean up existing policies
    
  2. Security
    - Room owners can manage their own rooms
    - Admins can manage all rooms
    - Public can view active rooms
*/

-- First, drop any existing policies that might conflict
DO $$
BEGIN
  -- Drop policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'rooms' 
    AND policyname = 'Anyone can view active rooms'
  ) THEN
    DROP POLICY "Anyone can view active rooms" ON rooms;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'rooms' 
    AND policyname = 'Room owners can manage their rooms'
  ) THEN
    DROP POLICY "Room owners can manage their rooms" ON rooms;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customers' 
    AND policyname = 'Users can view their assigned customers'
  ) THEN
    DROP POLICY "Users can view their assigned customers" ON customers;
  END IF;
END $$;

-- Create simplified room access policies
CREATE POLICY "Room owners can manage their rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (
    -- User is either the room owner or an admin
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (
        users.role = 'admin' OR 
        users.email = 'info@fusion-events.ca'
      )
    )
  )
  WITH CHECK (
    -- Same conditions for insert/update
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (
        users.role = 'admin' OR 
        users.email = 'info@fusion-events.ca'
      )
    )
  );

-- Allow public to view active rooms
CREATE POLICY "Public view access for active rooms"
  ON rooms
  FOR SELECT
  TO public
  USING (is_active = true);

-- Create helper function to check room access
CREATE OR REPLACE FUNCTION check_room_access(room_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if user is room owner
  IF EXISTS (
    SELECT 1 FROM rooms 
    WHERE id = room_id 
    AND owner_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user is admin
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND (
      role = 'admin' OR 
      email = 'info@fusion-events.ca'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Update activations policies to use simplified access
DO $$
BEGIN
  -- Drop existing policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'activations' 
    AND policyname = 'Admin can manage all activations'
  ) THEN
    DROP POLICY "Admin can manage all activations" ON activations;
  END IF;
END $$;

CREATE POLICY "Users can manage activations for their rooms"
  ON activations
  FOR ALL
  TO authenticated
  USING (
    -- User has access to the room this activation belongs to
    check_room_access(room_id)
  )
  WITH CHECK (
    check_room_access(room_id)
  );

-- Allow public to view approved activations
CREATE POLICY "Public view access for room activations"
  ON activations
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = activations.room_id 
      AND rooms.is_active = true
    )
  );