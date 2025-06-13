/*
  # Remove All Access Controls
  
  1. Changes
    - Disable RLS on all tables
    - Remove all policies
    - Allow direct database access
    
  2. Security Note
    - This removes all access control
    - Only use in development/testing
*/

-- Disable RLS on all tables
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE activations DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_access DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE question_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE activation_tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE host_controls DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE site_content DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$ 
BEGIN
  -- Drop all policies from rooms
  DROP POLICY IF EXISTS "enable_all_access" ON rooms;
  DROP POLICY IF EXISTS "public_view_rooms" ON rooms;
  
  -- Drop all policies from activations
  DROP POLICY IF EXISTS "enable_all_access" ON activations;
  DROP POLICY IF EXISTS "public_view_activations" ON activations;
  
  -- Drop all policies from customers
  DROP POLICY IF EXISTS "enable_all_access" ON customers;
  
  -- Drop all policies from customer_access
  DROP POLICY IF EXISTS "enable_all_access" ON customer_access;
END $$;