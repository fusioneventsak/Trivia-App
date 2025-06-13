/*
  # Multi-room event management system

  1. New Tables
    - `rooms`
      - `id` (uuid, primary key)
      - `name` (text, non-null)
      - `subdomain` (text, unique)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `owner_id` (uuid, foreign key to users)
      - `is_active` (boolean)
      - `settings` (jsonb)
      - `theme` (jsonb)
      - `logo_url` (text)
      - `domain` (text)
   
  2. Modified Tables
    - Add `room_id` to:
      - `game_sessions`
      - `activations`
      - `players`
      - `social_posts`
    
  3. Security
    - Enable RLS on `rooms` table
    - Add policies for room management
*/

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text UNIQUE NOT NULL,
  domain text,
  logo_url text,
  settings jsonb DEFAULT '{
    "allow_guest_players": true,
    "require_approval": false,
    "show_leaderboard": true,
    "max_players": 500
  }'::jsonb,
  theme jsonb DEFAULT '{
    "primary_color": "#6366F1",
    "secondary_color": "#8B5CF6",
    "background_color": "#F3F4F6",
    "text_color": "#1F2937"
  }'::jsonb,
  is_active boolean DEFAULT true,
  owner_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add room_id to game_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'room_id'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN room_id uuid REFERENCES rooms(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add room_id to activations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activations' AND column_name = 'room_id'
  ) THEN
    ALTER TABLE activations ADD COLUMN room_id uuid REFERENCES rooms(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add room_id to players
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'room_id'
  ) THEN
    ALTER TABLE players ADD COLUMN room_id uuid REFERENCES rooms(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add room_id to social_posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_posts' AND column_name = 'room_id'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN room_id uuid REFERENCES rooms(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add host_controls table for mobile control interface
CREATE TABLE IF NOT EXISTS host_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  access_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_host_room UNIQUE (room_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_controls ENABLE ROW LEVEL SECURITY;

-- Room policies
CREATE POLICY "Users can create rooms" 
  ON rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Room owners can manage their rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Anyone can view active rooms" 
  ON rooms
  FOR SELECT
  TO public
  USING (is_active = true);

-- Host Controls policies
CREATE POLICY "Host controls can be created by room owners"
  ON host_controls
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = host_controls.room_id
    AND rooms.owner_id = auth.uid()
  ));

CREATE POLICY "Host controls can be managed by room owners"
  ON host_controls
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = host_controls.room_id
    AND rooms.owner_id = auth.uid()
  ));

CREATE POLICY "Host can access their own controls"
  ON host_controls
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_room ON game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_activations_room ON activations(room_id);
CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_host_controls_room ON host_controls(room_id);