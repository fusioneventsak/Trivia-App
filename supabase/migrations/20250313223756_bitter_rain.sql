/*
  # System Enhancements Migration
  
  1. User Management
     - Add role field to users table for admin/regular user distinction
     - Add user profile fields for better user management
  
  2. Question Bank Templates
     - Create question_templates table for reusable templates across rooms
     - Add sharing capabilities with proper RLS policies
  
  3. Analytics Tables
     - Create analytics tables for tracking user and room activity
     - Add RLS policies for proper data access
*/

-- 1. Enhance users table with roles and profile fields
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user'::text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_picture_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login timestamptz;

-- Create function to check if user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT (auth.jwt() ->> 'email'::text) = 'info@fusion-events.ca'::text OR
         EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');
$$;

-- 2. Create Question Bank Templates
CREATE TABLE IF NOT EXISTS public.question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('multiple_choice', 'text_answer', 'poll')),
  question text NOT NULL,
  options jsonb DEFAULT '[]'::jsonb,
  correct_answer text,
  exact_answer text,
  media_type text DEFAULT 'none'::text CHECK (media_type IN ('none', 'image', 'youtube', 'gif')),
  media_url text,
  category text,
  difficulty text CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags text[],
  is_public boolean DEFAULT false,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add RLS to question templates
ALTER TABLE public.question_templates ENABLE ROW LEVEL SECURITY;

-- Templates can be viewed by their creator or if public
CREATE POLICY "Users can view their own templates or public ones" 
ON public.question_templates
FOR SELECT
USING ((auth.uid() = created_by) OR is_public = true);

-- Templates can only be modified by their creator or admins
CREATE POLICY "Users can modify their own templates" 
ON public.question_templates
FOR ALL
USING ((auth.uid() = created_by) OR is_admin())
WITH CHECK ((auth.uid() = created_by) OR is_admin());

-- 3. Analytics tables
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
  activation_id uuid REFERENCES public.activations(id) ON DELETE SET NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_room ON public.analytics_events(room_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON public.analytics_events(created_at);

-- Add RLS to analytics
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can view analytics for their own rooms
CREATE POLICY "Users can view analytics for their own rooms" 
ON public.analytics_events
FOR SELECT
USING (
  (room_id IS NULL) OR
  (EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = analytics_events.room_id
    AND rooms.owner_id = auth.uid()
  )) OR
  (user_id = auth.uid()) OR
  is_admin()
);

-- Create analytics summary view for quick access
CREATE OR REPLACE VIEW public.room_analytics_summary AS
SELECT 
  room_id,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(*) AS total_events,
  COUNT(DISTINCT CASE WHEN event_type = 'player_join' THEN id END) AS total_joins,
  COUNT(DISTINCT CASE WHEN event_type = 'question_answer' THEN id END) AS total_answers,
  MAX(created_at) AS last_activity
FROM 
  public.analytics_events
GROUP BY 
  room_id;

-- Add system settings table for global configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS for system settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can modify system settings
CREATE POLICY "Only admins can modify system settings" 
ON public.system_settings
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Everyone can read system settings
CREATE POLICY "Everyone can read system settings" 
ON public.system_settings
FOR SELECT
USING (true);

-- Insert default system settings
INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('allow_registration', 'true'::jsonb, 'Whether to allow new user registrations'),
  ('default_user_role', '"user"'::jsonb, 'Default role for new user registrations'),
  ('room_limits', '{"max_rooms_per_user": 5, "max_players_per_room": 500}'::jsonb, 'Default limits for rooms'),
  ('analytics_retention_days', '90'::jsonb, 'Number of days to retain analytics data')
ON CONFLICT (key) DO NOTHING;

-- Update existing rooms to include a reference to template source
ALTER TABLE public.activations ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.question_templates(id) ON DELETE SET NULL;