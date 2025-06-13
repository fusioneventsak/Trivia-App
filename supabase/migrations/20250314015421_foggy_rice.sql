/*
  # Fix Customer Access Controls

  1. Improved Access Controls
    - Better handling of 'ak' access
    - Updated RLS policies for customer access
    - Fixed admin access checks
    
  2. Debugging Functions
    - Added troubleshooting functions for easier debugging
    
  3. Fixes
    - Safer error handling in trigger functions
    - More permissive policies for authenticated users
*/

-- Fix customer access check function
CREATE OR REPLACE FUNCTION user_has_customer_access(p_customer_id text)
RETURNS boolean AS $$
BEGIN
  -- Special case for 'ak' customer - only admin users have access
  IF p_customer_id = 'ak' THEN
    -- Admin users are identified by email or role
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

-- Fix assignment of rooms to customers
CREATE OR REPLACE FUNCTION assign_room_to_customer()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id text;
BEGIN
  -- For INSERT operations
  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS NOT NULL THEN
      v_customer_id := NEW.customer_id;
    ELSE
      -- Default to 'ak' customer
      v_customer_id := 'ak';
      -- Update the room with the default customer_id
      UPDATE rooms SET customer_id = 'ak' WHERE id = NEW.id;
    END IF;
    
    -- Insert into customer_rooms mapping with explicit error handling
    BEGIN
      INSERT INTO customer_rooms (customer_id, room_id)
      VALUES (v_customer_id, NEW.id)
      ON CONFLICT (customer_id, room_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not assign room % to customer %. Error: %', 
        NEW.id, v_customer_id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Make sure ak customer exists
INSERT INTO customers (customer_id, name, settings, is_active)
VALUES ('ak', 'Master Admin', '{"isAdmin": true}'::jsonb, true)
ON CONFLICT (customer_id) DO NOTHING;

-- Add debug function to help identify access issues
CREATE OR REPLACE FUNCTION debug_customer_access(p_customer_id text)
RETURNS TABLE (
  has_access boolean,
  reason text,
  user_id uuid,
  user_email text,
  is_admin boolean,
  has_direct_access boolean,
  customer_exists boolean
) AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_is_admin boolean;
  v_has_direct_access boolean;
  v_customer_exists boolean;
BEGIN
  -- Get current user info
  SELECT auth.uid() INTO v_user_id;
  SELECT auth.jwt() ->> 'email' INTO v_user_email;
  
  -- Check if customer exists
  SELECT EXISTS(
    SELECT 1 FROM customers 
    WHERE customer_id = p_customer_id
  ) INTO v_customer_exists;
  
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = v_user_id 
    AND (role = 'admin' OR email = 'info@fusion-events.ca')
  ) INTO v_is_admin;
  
  -- Check direct customer access
  SELECT EXISTS (
    SELECT 1 FROM customer_access 
    WHERE customer_id = p_customer_id 
    AND user_id = v_user_id
  ) INTO v_has_direct_access;
  
  -- Special case for 'ak'
  IF p_customer_id = 'ak' THEN
    IF v_is_admin THEN
      RETURN QUERY SELECT 
        true, 
        'Admin can access ak', 
        v_user_id,
        v_user_email,
        v_is_admin,
        v_has_direct_access,
        v_customer_exists;
    ELSE
      RETURN QUERY SELECT 
        false, 
        'Non-admin cannot access ak', 
        v_user_id,
        v_user_email,
        v_is_admin,
        v_has_direct_access,
        v_customer_exists;
    END IF;
  ELSIF v_is_admin THEN
    RETURN QUERY SELECT 
      true, 
      'Admin can access any customer', 
      v_user_id,
      v_user_email,
      v_is_admin,
      v_has_direct_access,
      v_customer_exists;
  ELSIF v_has_direct_access THEN
    RETURN QUERY SELECT 
      true, 
      'User has direct access', 
      v_user_id,
      v_user_email,
      v_is_admin,
      v_has_direct_access,
      v_customer_exists;
  ELSE
    RETURN QUERY SELECT 
      false, 
      'No access', 
      v_user_id,
      v_user_email,
      v_is_admin,
      v_has_direct_access,
      v_customer_exists;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies for customer access
DROP POLICY IF EXISTS "Users can view their assigned customers" ON customers;
CREATE POLICY "Users can view their assigned customers"
  ON customers
  FOR SELECT
  TO authenticated
  USING (
    (customer_id = 'ak' AND (
      auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR 
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    )) 
    OR 
    EXISTS (
      SELECT 1 FROM customer_access 
      WHERE customer_access.customer_id = customers.customer_id 
      AND customer_access.user_id = auth.uid()
    )
  );

-- Fix RLS policies for rooms to better respect customer boundaries
DROP POLICY IF EXISTS "Room owners can manage their rooms" ON rooms;
CREATE POLICY "Room owners can manage their rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (
    (auth.uid() = owner_id) OR 
    (
      customer_id IS NOT NULL AND (
        -- Access via customer_id
        (customer_id = 'ak' AND (
          auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR 
          EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
        )) 
        OR 
        EXISTS (
          SELECT 1 FROM customer_access 
          WHERE customer_access.customer_id = rooms.customer_id 
          AND customer_access.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    (auth.uid() = owner_id) OR 
    (
      customer_id IS NOT NULL AND (
        -- Access via customer_id
        (customer_id = 'ak' AND (
          auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR 
          EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
        )) 
        OR 
        EXISTS (
          SELECT 1 FROM customer_access 
          WHERE customer_access.customer_id = rooms.customer_id 
          AND customer_access.user_id = auth.uid()
        )
      )
    )
  );

-- Grant admin users a special role to access system tables
CREATE OR REPLACE FUNCTION set_claim_is_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'admin' OR NEW.email = 'info@fusion-events.ca' THEN
    -- Set is_admin claim to true for admins
    PERFORM supabase_functions.http(
      'http://auth:9999/admin/v1/jwt/refresh',
      'POST',
      jsonb_build_object(
        'refresh_token', (SELECT refresh_token FROM auth.refresh_tokens WHERE user_id = NEW.id ORDER BY created_at DESC LIMIT 1)
      ),
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_functions.get_service_role_token()
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS set_claim_is_admin_trigger ON users;

-- Test function to verify admin access for the current user
CREATE OR REPLACE FUNCTION verify_admin_access()
RETURNS boolean AS $$
BEGIN
  RETURN 
    auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql;