/*
  # Update Admin Email and Access Controls
  
  1. Changes
    - Change admin email from info@fusion-events.ca to arthurk@fusion-events.ca
    - Update all functions and policies that check admin email
    - Ensure existing admin keeps proper access
*/

-- Update the is_admin function to use new email
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    COALESCE(auth.jwt() ->> 'email', '') = 'arthurk@fusion-events.ca'
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    );
$$;

-- Update any policies that directly reference the admin email
DO $$
BEGIN
  -- Update services policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'services' 
    AND policyname = 'Admin full access for services'
  ) THEN
    DROP POLICY "Admin full access for services" ON services;
    CREATE POLICY "Admin full access for services"
      ON services
      FOR ALL
      TO authenticated
      USING (auth.jwt() ->> 'email' = 'arthurk@fusion-events.ca');
  END IF;

  -- Update site_content policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'site_content' 
    AND policyname = 'Admin full access for site_content'
  ) THEN
    DROP POLICY "Admin full access for site_content" ON site_content;
    CREATE POLICY "Admin full access for site_content"
      ON site_content
      FOR ALL
      TO authenticated
      USING (auth.jwt() ->> 'email' = 'arthurk@fusion-events.ca');
  END IF;

  -- Update event_details policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'event_details' 
    AND policyname = 'Admin can manage all event details'
  ) THEN
    DROP POLICY "Admin can manage all event details" ON event_details;
    CREATE POLICY "Admin can manage all event details"
      ON event_details
      FOR ALL
      TO authenticated
      USING (auth.jwt() ->> 'email' = 'arthurk@fusion-events.ca');
  END IF;
END $$;

-- Update any existing admin user's email
UPDATE users
SET 
  email = 'arthurk@fusion-events.ca',
  role = 'admin'
WHERE email = 'info@fusion-events.ca';

-- Drop and recreate admin-related policies
DROP POLICY IF EXISTS "admin_full_access_rooms" ON rooms;
CREATE POLICY "admin_full_access_rooms"
ON rooms
FOR ALL
TO authenticated
USING (is_admin());

DROP POLICY IF EXISTS "admin_full_access_activations" ON activations;
CREATE POLICY "admin_full_access_activations"
ON activations
FOR ALL
TO authenticated
USING (is_admin());

DROP POLICY IF EXISTS "admin_full_access_customers" ON customers;
CREATE POLICY "admin_full_access_customers"
ON customers
FOR ALL
TO authenticated
USING (is_admin());