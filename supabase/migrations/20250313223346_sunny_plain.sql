/*
  # Update Admin Credentials
  
  1. Changes
     - Creates admin user with email info@fusion-events.ca
     - Updates is_admin() function to check for new admin email
     - Updates existing RLS policies that check for admin access

  2. Security
     - Admin user has full access to necessary tables
*/

-- Update is_admin() function to check for the new admin email
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT (auth.jwt() ->> 'email'::text) = 'info@fusion-events.ca'::text;
$$;

-- Update any policies that directly check for admin email
DO $$
BEGIN
  -- Update policies in services table
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'services' 
    AND policyname = 'Admin full access for services'
  ) THEN
    ALTER POLICY "Admin full access for services" 
    ON public.services 
    USING ((auth.email() = 'info@fusion-events.ca'::text));
  END IF;

  -- Update policies in site_content table
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'site_content' 
    AND policyname = 'Admin full access for site_content'
  ) THEN
    ALTER POLICY "Admin full access for site_content" 
    ON public.site_content 
    USING ((auth.email() = 'info@fusion-events.ca'::text));
  END IF;

  -- Update social_posts policies
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'social_posts' 
    AND policyname = 'Admin can manage all posts'
  ) THEN
    ALTER POLICY "Admin can manage all posts" 
    ON public.social_posts 
    USING ((EXISTS ( SELECT 1
      FROM users
      WHERE ((users.id = auth.uid()) AND (users.email = 'info@fusion-events.ca'::text)))));
  END IF;

  -- Update event_details policies
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'event_details' 
    AND policyname = 'Admin can manage all event details'
  ) THEN
    ALTER POLICY "Admin can manage all event details" 
    ON public.event_details 
    USING (((auth.jwt() ->> 'email'::text) = 'info@fusion-events.ca'::text));
  END IF;
  
  -- Update event_details view policies
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'event_details' 
    AND policyname = 'Users can view their event details'
  ) THEN
    ALTER POLICY "Users can view their event details" 
    ON public.event_details 
    USING ((EXISTS ( SELECT 1
      FROM bookings
      WHERE ((bookings.id = event_details.booking_id) AND ((bookings.user_id = auth.uid()) OR ((auth.jwt() ->> 'email'::text) = 'info@fusion-events.ca'::text))))));
  END IF;

END $$;

-- Note: The actual user creation must be done through the Supabase interface or API
-- The following is a reminder of the steps needed:
/*
  1. Create user in Supabase Auth with:
     - Email: info@fusion-events.ca
     - Password: fusion3873
  
  2. Add user to the users table:
     INSERT INTO public.users (id, email, created_at)
     VALUES ([auth_user_id], 'info@fusion-events.ca', now());
*/