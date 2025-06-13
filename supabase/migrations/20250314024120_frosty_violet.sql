/*
  # Disable Row Level Security
  
  1. Changes
    - Disable RLS on all tables to remove authentication requirements
    - Drop all existing policies since they won't be needed
    - Keep tables accessible to everyone
    
  2. Security Note
    - This removes all access control - everyone can access everything
    - Only use this in development/testing environments
*/

-- Drop all existing policies
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