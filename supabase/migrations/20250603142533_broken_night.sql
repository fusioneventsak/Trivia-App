/*
  # Fix RLS Issues for All Tables
  
  1. Changes
    - Enable RLS on all tables that have policies but RLS disabled
    - Maintain existing policies
    
  2. Security
    - Properly enable row-level security for all public tables
    - Ensure security policies work as intended
*/

-- Enable RLS on tables with existing policies
ALTER TABLE public.activation_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Ensure policies for activations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activations' 
    AND policyname = 'Allow public to insert activations'
  ) THEN
    CREATE POLICY "Allow public to insert activations"
      ON activations FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activations' 
    AND policyname = 'Allow public to read activations'
  ) THEN
    CREATE POLICY "Allow public to read activations"
      ON activations FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- Ensure policies for players
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'players' 
    AND policyname = 'Allow public to insert players'
  ) THEN
    CREATE POLICY "Allow public to insert players"
      ON players FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'players' 
    AND policyname = 'Allow public read access to players'
  ) THEN
    CREATE POLICY "Allow public read access to players"
      ON players FOR SELECT
      TO public
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'players' 
    AND policyname = 'Allow authenticated users to update player scores'
  ) THEN
    CREATE POLICY "Allow authenticated users to update player scores"
      ON players FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Ensure policies for game_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_sessions' 
    AND policyname = 'Public can view game sessions'
  ) THEN
    CREATE POLICY "Public can view game sessions"
      ON game_sessions FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- Ensure policies for rooms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'rooms' 
    AND policyname = 'Users can create rooms'
  ) THEN
    CREATE POLICY "Users can create rooms"
      ON rooms FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

-- Ensure policies for question_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'question_templates' 
    AND policyname = 'Users can view their own templates or public ones'
  ) THEN
    CREATE POLICY "Users can view their own templates or public ones"
      ON question_templates FOR SELECT
      TO public
      USING ((auth.uid() = created_by) OR (is_public = true));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'question_templates' 
    AND policyname = 'Users can modify their own templates'
  ) THEN
    CREATE POLICY "Users can modify their own templates"
      ON question_templates FOR ALL
      TO public
      USING ((auth.uid() = created_by) OR is_admin())
      WITH CHECK ((auth.uid() = created_by) OR is_admin());
  END IF;
END $$;

-- Ensure policies for analytics_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'analytics_events' 
    AND policyname = 'Users can view analytics for their own rooms'
  ) THEN
    CREATE POLICY "Users can view analytics for their own rooms"
      ON analytics_events FOR SELECT
      TO public
      USING ((room_id IS NULL) OR (EXISTS (
        SELECT 1 FROM rooms
        WHERE rooms.id = analytics_events.room_id
        AND rooms.owner_id = auth.uid()
      )) OR (user_id = auth.uid()) OR is_admin());
  END IF;
END $$;

-- Ensure policies for activation_tests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activation_tests' 
    AND policyname = 'Users can view test results for their rooms'
  ) THEN
    CREATE POLICY "Users can view test results for their rooms"
      ON activation_tests FOR SELECT
      TO public
      USING ((EXISTS (
        SELECT 1 FROM activations a
        JOIN rooms r ON a.room_id = r.id
        WHERE a.id = activation_tests.activation_id
        AND r.owner_id = auth.uid()
      )) OR is_admin());
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activation_tests' 
    AND policyname = 'Users can create test results for their rooms'
  ) THEN
    CREATE POLICY "Users can create test results for their rooms"
      ON activation_tests FOR INSERT
      TO public
      WITH CHECK ((EXISTS (
        SELECT 1 FROM activations a
        JOIN rooms r ON a.room_id = r.id
        WHERE a.id = activation_tests.activation_id
        AND r.owner_id = auth.uid()
      )) OR is_admin());
  END IF;
END $$;

-- Ensure policies for customer_rooms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_rooms' 
    AND policyname = 'Admins can manage customer rooms'
  ) THEN
    CREATE POLICY "Admins can manage customer rooms"
      ON customer_rooms FOR ALL
      TO authenticated
      USING (((auth.jwt() ->> 'email'::text) = 'info@fusion-events.ca'::text) OR (EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'::text
      )) OR (EXISTS (
        SELECT 1 FROM rooms
        WHERE rooms.id = customer_rooms.room_id
        AND rooms.owner_id = auth.uid()
      )));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_rooms' 
    AND policyname = 'Allow trigger to assign room to customer'
  ) THEN
    CREATE POLICY "Allow trigger to assign room to customer"
      ON customer_rooms FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM rooms
        WHERE rooms.id = customer_rooms.room_id
        AND rooms.owner_id = auth.uid()
      ));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_rooms' 
    AND policyname = 'Users can view rooms for their customers'
  ) THEN
    CREATE POLICY "Users can view rooms for their customers"
      ON customer_rooms FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM customer_access
        WHERE customer_access.customer_id = customer_rooms.customer_id
        AND customer_access.user_id = auth.uid()
      ));
  END IF;
END $$;

-- Ensure policies for customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' 
    AND policyname = 'Admin full access for customers'
  ) THEN
    CREATE POLICY "Admin full access for customers"
      ON customers FOR ALL
      TO authenticated
      USING (is_admin());
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' 
    AND policyname = 'Users can view their own customers'
  ) THEN
    CREATE POLICY "Users can view their own customers"
      ON customers FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM customer_access
        WHERE customer_access.customer_id = customers.customer_id
        AND customer_access.user_id = auth.uid()
      ));
  END IF;
END $$;

-- Ensure policies for customer_access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_access' 
    AND policyname = 'Admin full access for customer access'
  ) THEN
    CREATE POLICY "Admin full access for customer access"
      ON customer_access FOR ALL
      TO authenticated
      USING (is_admin());
  END IF;
END $$;