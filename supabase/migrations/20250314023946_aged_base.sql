/*
  # Fix Policy Syntax for All Tables
  
  1. Changes
    - Drop existing policies
    - Create new policies with proper USING/WITH CHECK clauses
    - Maintain simple authentication-based access
    - Keep public access for active content
    
  2. Security
    - Authenticated users can perform all operations
    - Public users can only view active content
*/

-- Drop existing policies
DROP POLICY IF EXISTS "authenticated_access_rooms" ON rooms;
DROP POLICY IF EXISTS "public_view_rooms" ON rooms;
DROP POLICY IF EXISTS "authenticated_access_activations" ON activations;
DROP POLICY IF EXISTS "public_view_activations" ON activations;
DROP POLICY IF EXISTS "admin_full_access_customers" ON customers;
DROP POLICY IF EXISTS "users_view_customers" ON customers;
DROP POLICY IF EXISTS "Admin manage customer access" ON customer_access;
DROP POLICY IF EXISTS "View own customer access" ON customer_access;

-- Create new policies for rooms
CREATE POLICY "authenticated_insert_rooms"
ON rooms
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_select_rooms"
ON rooms
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_update_rooms"
ON rooms
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_delete_rooms"
ON rooms
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "public_view_rooms"
ON rooms
FOR SELECT
TO public
USING (is_active = true);

-- Create new policies for activations
CREATE POLICY "authenticated_insert_activations"
ON activations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_select_activations"
ON activations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_update_activations"
ON activations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_delete_activations"
ON activations
FOR DELETE
TO authenticated
USING (true);

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

-- Create new policies for customers
CREATE POLICY "authenticated_insert_customers"
ON customers
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_select_customers"
ON customers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_update_customers"
ON customers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_delete_customers"
ON customers
FOR DELETE
TO authenticated
USING (true);

-- Create new policies for customer_access
CREATE POLICY "authenticated_insert_customer_access"
ON customer_access
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_select_customer_access"
ON customer_access
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_update_customer_access"
ON customer_access
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_delete_customer_access"
ON customer_access
FOR DELETE
TO authenticated
USING (true);

-- Make sure RLS is enabled on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_access ENABLE ROW LEVEL SECURITY;

-- Reset admin user if needed
UPDATE users 
SET role = 'admin'
WHERE email = 'arthurk@fusion-events.ca';