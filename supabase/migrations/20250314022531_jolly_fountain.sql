/*
  # Fix Master Admin Customer Access
  
  1. Changes
    - Fix access to 'ak' customer for admin users
    - Simplify admin access checks
    - Update customer access policies
    - Add helper functions for access control
    
  2. Security
    - Ensure admin users can access 'ak' customer
    - Maintain proper access control
*/

-- Drop existing customer policies
DROP POLICY IF EXISTS "Admins can manage all customers" ON customers;
DROP POLICY IF EXISTS "Users can view their assigned customers" ON customers;

-- Create new customer access policies
CREATE POLICY "Admin access to customers"
ON customers
FOR ALL
TO authenticated
USING (
  -- Admin users can access all customers
  auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

CREATE POLICY "Users can view assigned customers"
ON customers
FOR SELECT
TO authenticated
USING (
  -- Users can view customers they have access to
  EXISTS (
    SELECT 1 FROM customer_access
    WHERE customer_access.customer_id = customers.customer_id
    AND customer_access.user_id = auth.uid()
  )
);

-- Ensure 'ak' customer exists and is properly configured
INSERT INTO customers (customer_id, name, settings, is_active)
VALUES (
  'ak',
  'Master Admin',
  jsonb_build_object(
    'isAdmin', true,
    'allowFullAccess', true
  ),
  true
)
ON CONFLICT (customer_id) DO UPDATE
SET 
  settings = jsonb_build_object(
    'isAdmin', true,
    'allowFullAccess', true
  ),
  is_active = true;

-- Create function to check admin access
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    );
$$;

-- Create function to check customer access
CREATE OR REPLACE FUNCTION has_customer_access(p_customer_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Admin users always have access
  IF is_admin() THEN
    RETURN true;
  END IF;

  -- Check customer access table
  RETURN EXISTS (
    SELECT 1 FROM customer_access
    WHERE customer_id = p_customer_id
    AND user_id = auth.uid()
  );
END;
$$;

-- Update customer_access policies
DROP POLICY IF EXISTS "Admins can manage customer access" ON customer_access;
DROP POLICY IF EXISTS "Users can view their own access" ON customer_access;

CREATE POLICY "Admin manage customer access"
ON customer_access
FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "View own customer access"
ON customer_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());