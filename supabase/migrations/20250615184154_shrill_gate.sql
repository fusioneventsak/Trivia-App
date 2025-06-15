/*
  # Fix Analytics Events RLS Policy
  
  1. Changes
    - Add INSERT policy for public users to create analytics events
    - This allows the game to track player joins and other events
    
  2. Security
    - Public users can only insert analytics events
    - They cannot update or delete existing events
*/

-- Ensure RLS is enabled
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public can insert analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Users can view analytics for their own rooms" ON public.analytics_events;

-- Allow public users to insert analytics events
CREATE POLICY "Public can insert analytics events"
  ON public.analytics_events
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Keep the existing SELECT policy for viewing analytics
CREATE POLICY "Users can view analytics for their own rooms" 
  ON public.analytics_events
  FOR SELECT
  TO public
  USING (
    (room_id IS NULL) OR
    (EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = analytics_events.room_id
      AND rooms.owner_id = auth.uid()
    )) OR
    (user_id = auth.uid()) OR
    (EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    ))
  );