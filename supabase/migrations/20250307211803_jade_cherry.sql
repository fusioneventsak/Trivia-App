/*
  # Initial Schema Setup for Trivia Game

  1. New Tables
    - `players`
      - `id` (uuid, primary key)
      - `name` (text)
      - `score` (integer)
      - `created_at` (timestamp)
    - `game_sessions`
      - `id` (uuid, primary key)
      - `is_live` (boolean)
      - `current_activation` (text)
      - `created_at` (timestamp)
    - `activations`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key)
      - `type` (text)
      - `question` (text)
      - `options` (jsonb)
      - `correct_answer` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Players table
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  score integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Game sessions table
CREATE TABLE game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_live boolean DEFAULT true,
  current_activation text,
  created_at timestamptz DEFAULT now()
);

-- Activations table
CREATE TABLE activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES game_sessions(id),
  type text NOT NULL,
  question text NOT NULL,
  options jsonb,
  correct_answer text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to players"
  ON players
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users to insert players"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update player scores"
  ON players
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to manage game sessions"
  ON game_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access to game sessions"
  ON game_sessions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users to manage activations"
  ON activations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access to activations"
  ON activations
  FOR SELECT
  TO public
  USING (true);