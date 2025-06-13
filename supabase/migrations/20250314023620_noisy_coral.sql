/*
  # Fix Room Access Dependencies
  
  1. Changes
    - Drop policies in correct order to handle dependencies
    - Recreate simplified access policies
    - Update check_room_access function first to avoid dependency issues
*/

-- First update the check_room_access function to a simpler version
CREATE OR REPLACE FUNCTION check_room_access(room_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql;

-- Now we can safely drop the activation policies that depend on it
DROP POLICY IF EXISTS "Users can manage activations for their rooms" ON activations;
DROP POLICY IF EXISTS "public_view_activations" ON activations;

-- Drop room policies
DROP POLICY IF EXISTS "admin_full_access_rooms" ON rooms;
DROP POLICY IF EXISTS "owners_manage_rooms" ON rooms;
DROP POLICY IF EXISTS "public_view_rooms" ON rooms;

-- Drop other complex functions
DROP FUNCTION IF EXISTS user_has_customer_access(text);
DROP FUNCTION IF EXISTS has_customer_access(text);

-- Simple policy - any authenticated user can access rooms
CREATE POLICY "authenticated_access_rooms"
ON rooms
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Keep public view access for active rooms
CREATE POLICY "public_view_rooms"
ON rooms
FOR SELECT
TO public
USING (is_active = true);

-- Simple policy - any authenticated user can access activations
CREATE POLICY "authenticated_access_activations"
ON activations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Keep public view access for activations in active rooms
CREATE POLICY "public_view_activations"
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