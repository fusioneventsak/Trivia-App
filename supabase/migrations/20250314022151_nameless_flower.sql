/*
  # Simplified Room Access Control
  
  1. Changes
    - Remove complex customer-based access checks
    - Simplify to basic owner/admin access model
    - Fix public access for active rooms
    - Add direct access policies
    
  2. Security
    - Room owners can manage their rooms
    - Admins can manage all rooms
    - Public can view active rooms
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Room owners can manage their rooms" ON rooms;
DROP POLICY IF EXISTS "Public view access for active rooms" ON rooms;
DROP POLICY IF EXISTS "Public view access for room activations" ON activations;

-- Simple policy for room owners and admins
CREATE POLICY "Users can manage their rooms"
ON rooms
FOR ALL
TO authenticated
USING (
  -- User is either the room owner or an admin
  auth.uid() = owner_id OR
  auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Public can view active rooms
CREATE POLICY "Public can view active rooms"
ON rooms
FOR SELECT
TO public
USING (is_active = true);

-- Fix activations access
CREATE POLICY "Users can manage activations"
ON activations
FOR ALL
TO authenticated
USING (
  -- User has access to the parent room
  EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = activations.room_id
    AND (
      rooms.owner_id = auth.uid() OR
      auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
      )
    )
  )
);

-- Public can view activations for active rooms
CREATE POLICY "Public can view activations"
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

-- Simple function to check room access
CREATE OR REPLACE FUNCTION check_room_access(room_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = room_id
    AND (
      rooms.owner_id = auth.uid() OR
      auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
      )
    )
  );
END;
$$ LANGUAGE plpgsql;