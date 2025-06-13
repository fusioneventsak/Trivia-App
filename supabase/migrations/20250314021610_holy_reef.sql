/*
  # Fix Room Access Policies

  1. Changes
    - Simplify room access policies to focus on customer-based access
    - Add proper public access for active rooms
    - Fix customer access checks
    - Update helper functions for access control

  2. Security
    - Maintain proper access control based on customer boundaries
    - Ensure room owners can always access their rooms
    - Allow admins to access all rooms
    - Public can only view active rooms
*/

-- First, drop existing policies to avoid conflicts
DO $$
BEGIN
  -- Drop room policies
  DROP POLICY IF EXISTS "Room owners can manage their rooms" ON rooms;
  DROP POLICY IF EXISTS "Public view access for active rooms" ON rooms;
  DROP POLICY IF EXISTS "Anyone can view active rooms" ON rooms;
END $$;

-- Create new room access policies
CREATE POLICY "Room owners can manage their rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (
    -- User is either:
    -- 1. The room owner
    -- 2. Has access to the customer this room belongs to
    -- 3. Is an admin
    auth.uid() = owner_id 
    OR 
    (
      customer_id IS NOT NULL 
      AND user_has_customer_access(customer_id)
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
          users.role = 'admin' 
          OR users.email = 'info@fusion-events.ca'
        )
      )
    )
  )
  WITH CHECK (
    -- Same conditions for insert/update
    auth.uid() = owner_id 
    OR 
    (
      customer_id IS NOT NULL 
      AND user_has_customer_access(customer_id)
    )
    OR
    (
      EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
          users.role = 'admin' 
          OR users.email = 'info@fusion-events.ca'
        )
      )
    )
  );

-- Allow public to view active rooms
CREATE POLICY "Public view access for active rooms"
  ON rooms
  FOR SELECT
  TO public
  USING (is_active = true);

-- Update the user_has_customer_access function to be more robust
CREATE OR REPLACE FUNCTION user_has_customer_access(p_customer_id text)
RETURNS boolean AS $$
BEGIN
  -- Special case for 'ak' customer - only admin users have access
  IF p_customer_id = 'ak' THEN
    RETURN (
      auth.jwt() ->> 'email' = 'info@fusion-events.ca'
      OR EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND role = 'admin'
      )
    );
  END IF;
  
  -- Admin users always have access to any customer
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR email = 'info@fusion-events.ca')
  ) THEN
    RETURN true;
  END IF;
  
  -- Check customer access table
  RETURN EXISTS (
    SELECT 1 FROM customer_access 
    WHERE customer_id = p_customer_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql;

-- Update the check_room_access function to use customer-based access
CREATE OR REPLACE FUNCTION check_room_access(room_id uuid)
RETURNS boolean AS $$
DECLARE
  v_customer_id text;
  v_owner_id uuid;
BEGIN
  -- Get room details
  SELECT customer_id, owner_id 
  INTO v_customer_id, v_owner_id
  FROM rooms 
  WHERE id = room_id;
  
  -- Room not found
  IF v_customer_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check access:
  -- 1. Room owner always has access
  -- 2. User has access to the customer
  -- 3. User is admin
  RETURN 
    auth.uid() = v_owner_id 
    OR user_has_customer_access(v_customer_id)
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (
        users.role = 'admin' 
        OR users.email = 'info@fusion-events.ca'
      )
    );
END;
$$ LANGUAGE plpgsql;

-- Add debug function to help troubleshoot access issues
CREATE OR REPLACE FUNCTION debug_room_access(p_room_id uuid)
RETURNS TABLE (
  has_access boolean,
  reason text,
  user_id uuid,
  user_email text,
  room_owner_id uuid,
  room_customer_id text,
  is_admin boolean,
  has_customer_access boolean
) AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_room_owner_id uuid;
  v_room_customer_id text;
  v_is_admin boolean;
  v_has_customer_access boolean;
BEGIN
  -- Get current user info
  SELECT auth.uid() INTO v_user_id;
  SELECT auth.jwt() ->> 'email' INTO v_user_email;
  
  -- Get room info
  SELECT owner_id, customer_id 
  FROM rooms 
  WHERE id = p_room_id 
  INTO v_room_owner_id, v_room_customer_id;
  
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = v_user_id 
    AND (role = 'admin' OR email = 'info@fusion-events.ca')
  ) INTO v_is_admin;
  
  -- Check customer access
  SELECT user_has_customer_access(v_room_customer_id) INTO v_has_customer_access;
  
  -- Return detailed access info
  RETURN QUERY 
  SELECT 
    CASE WHEN v_user_id = v_room_owner_id THEN true
         WHEN v_is_admin THEN true
         WHEN v_has_customer_access THEN true
         ELSE false
    END as has_access,
    CASE WHEN v_user_id = v_room_owner_id THEN 'User is room owner'
         WHEN v_is_admin THEN 'User is admin'
         WHEN v_has_customer_access THEN 'User has customer access'
         ELSE 'No access'
    END as reason,
    v_user_id,
    v_user_email,
    v_room_owner_id,
    v_room_customer_id,
    v_is_admin,
    v_has_customer_access;
END;
$$ LANGUAGE plpgsql;