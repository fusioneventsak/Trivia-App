/*
  # Restore Original Admin Email
  
  1. Changes
    - Change admin email back to info@fusion-events.ca
    - Update all references to admin email
    - Ensure admin user has proper access
*/

-- Update admin user in auth schema
UPDATE auth.users 
SET email = 'info@fusion-events.ca'
WHERE email = 'arthurk@fusion-events.ca';

-- Update admin user in public schema
UPDATE public.users
SET 
  email = 'info@fusion-events.ca',
  role = 'admin'
WHERE email = 'arthurk@fusion-events.ca';

-- Update is_admin function to use original email
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

-- Ensure admin has access to 'ak' customer
INSERT INTO customer_access (
  customer_id,
  user_id,
  access_level
)
SELECT 
  'ak',
  id,
  'admin'
FROM users 
WHERE email = 'info@fusion-events.ca'
ON CONFLICT (customer_id, user_id) DO NOTHING;