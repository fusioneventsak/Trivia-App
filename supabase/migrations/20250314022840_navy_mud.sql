/*
  # Fix Admin Access Once and For All
  
  1. Changes
    - Simplify admin access checks
    - Remove complex customer-based access for admins
    - Ensure admins can access everything
    - Fix room access policies
    
  2. Security
    - Admin users get full access to everything
    - Keep existing user access controls
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can manage their rooms" ON rooms;
DROP POLICY IF EXISTS "Public can view active rooms" ON rooms;
DROP POLICY IF EXISTS "Users can manage activations" ON activations;
DROP POLICY IF EXISTS "Public can view activations" ON activations;
DROP POLICY IF EXISTS "Admin access to customers" ON customers;
DROP POLICY IF EXISTS "Users can view assigned customers" ON customers;

-- Create a super simple admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    COALESCE(auth.jwt() ->> 'email', '') = 'info@fusion-events.ca'
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    );
$$;

-- Simple room access policy - admins get full access
CREATE POLICY "admin_full_access_rooms"
ON rooms
FOR ALL
TO authenticated
USING (is_admin());

-- Room owners can manage their rooms
CREATE POLICY "owners_manage_rooms"
ON rooms
FOR ALL
TO authenticated
USING (auth.uid() = owner_id);

-- Public can view active rooms
CREATE POLICY "public_view_rooms"
ON rooms
FOR SELECT
TO public
USING (is_active = true);

-- Simple activations access - admins get full access
CREATE POLICY "admin_full_access_activations"
ON activations
FOR ALL
TO authenticated
USING (is_admin());

-- Room owners can manage their activations
CREATE POLICY "owners_manage_activations"
ON activations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = activations.room_id
    AND rooms.owner_id = auth.uid()
  )
);

-- Public can view activations for active rooms
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

-- Simple customer access - admins get full access
CREATE POLICY "admin_full_access_customers"
ON customers
FOR ALL
TO authenticated
USING (is_admin());

-- Users can view their assigned customers
CREATE POLICY "users_view_customers"
ON customers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_access
    WHERE customer_access.customer_id = customers.customer_id
    AND customer_access.user_id = auth.uid()
  )
);

-- Ensure admin user has proper role
DO $$
BEGIN
  UPDATE users
  SET role = 'admin'
  WHERE email = 'info@fusion-events.ca';
END $$;