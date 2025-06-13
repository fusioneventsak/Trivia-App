/*
  # Fix Room Access Policies

  1. Changes
    - Drop existing policies
    - Create new policies with proper permissions:
      - Authenticated users can perform all operations
      - Public users can only view active content
    
  2. Security
    - Authenticated users can perform all operations
    - Public users can only view active content
*/

-- Drop existing policies
DROP POLICY IF EXISTS "authenticated_insert_rooms" ON rooms;
DROP POLICY IF EXISTS "authenticated_select_rooms" ON rooms;
DROP POLICY IF EXISTS "authenticated_update_rooms" ON rooms;
DROP POLICY IF EXISTS "authenticated_delete_rooms" ON rooms;
DROP POLICY IF EXISTS "public_view_rooms" ON rooms;

DROP POLICY IF EXISTS "authenticated_insert_activations" ON activations;
DROP POLICY IF EXISTS "authenticated_select_activations" ON activations;
DROP POLICY IF EXISTS "authenticated_update_activations" ON activations;
DROP POLICY IF EXISTS "authenticated_delete_activations" ON activations;
DROP POLICY IF EXISTS "public_view_activations" ON activations;

DROP POLICY IF EXISTS "authenticated_insert_customers" ON customers;
DROP POLICY IF EXISTS "authenticated_select_customers" ON customers;
DROP POLICY IF EXISTS "authenticated_update_customers" ON customers;
DROP POLICY IF EXISTS "authenticated_delete_customers" ON customers;

DROP POLICY IF EXISTS "authenticated_insert_customer_access" ON customer_access;
DROP POLICY IF EXISTS "authenticated_select_customer_access" ON customer_access;
DROP POLICY IF EXISTS "authenticated_update_customer_access" ON customer_access;
DROP POLICY IF EXISTS "authenticated_delete_customer_access" ON customer_access;

-- Create new simplified policies for rooms
CREATE POLICY "enable_all_access"
  ON rooms
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "public_view_rooms"
  ON rooms
  FOR SELECT
  TO public
  USING (is_active = true);

-- Create new simplified policies for activations
CREATE POLICY "enable_all_access"
  ON activations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

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

-- Create new simplified policies for customers
CREATE POLICY "enable_all_access"
  ON customers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new simplified policies for customer_access
CREATE POLICY "enable_all_access"
  ON customer_access
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Make sure RLS is enabled on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_access ENABLE ROW LEVEL SECURITY;