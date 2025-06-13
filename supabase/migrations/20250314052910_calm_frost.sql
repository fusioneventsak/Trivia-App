/*
  # Create Admin User Migration
  
  1. Changes
    - Create admin user with proper credentials
    - Set admin role and permissions
    - Fix ON CONFLICT clause to use email constraint
*/

-- Create admin user if not exists
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- First try to find existing admin user
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'arthurk@fusion-events.ca';
  
  -- If admin doesn't exist, create them
  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'arthurk@fusion-events.ca',
      crypt('fusion3873', gen_salt('bf')),
      now(),
      now(),
      now()
    )
    RETURNING id INTO v_user_id;
  END IF;

  -- Create or update user record in public schema
  INSERT INTO public.users (
    id,
    email,
    role,
    created_at,
    last_login
  ) VALUES (
    v_user_id,
    'arthurk@fusion-events.ca',
    'admin',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    role = 'admin',
    last_login = now();

  -- Ensure admin has access to 'ak' customer
  INSERT INTO customer_access (
    customer_id,
    user_id,
    access_level
  ) VALUES (
    'ak',
    v_user_id,
    'admin'
  )
  ON CONFLICT (customer_id, user_id) DO NOTHING;
END $$;