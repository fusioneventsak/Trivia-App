/*
  # Fix Users Table RLS Policies

  1. Changes
     - Modify existing RLS policies for the users table
     - Add policy to allow self-registration
     - Add policy for updating user profiles
     - Fix admin privileges

  2. Security
     - Allow users to create their own records (with matching IDs)
     - Allow users to update their own records
     - Allow admins to manage all user records
*/

-- Remove existing policies (if they exist) to replace them with improved ones
DROP POLICY IF EXISTS "Users can read their own data" ON public.users;
DROP POLICY IF EXISTS "Admin full access on users" ON public.users;

-- Create better policies for user management
CREATE POLICY "Users can view their own data" 
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own data" 
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own data" 
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admin can manage all users
CREATE POLICY "Admin full access to users" 
ON public.users
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Allow public access for certain operations 
-- (needed for registration and potentially for public profiles)
CREATE POLICY "Public can view minimal user data" 
ON public.users
FOR SELECT
TO anon
USING (false); -- Initially restrictive, can be modified as needed