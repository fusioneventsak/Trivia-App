/*
  # Add RLS policies for activations table

  1. Security Changes
    - Enable RLS on activations table (if not already enabled)
    - Add policies for:
      - Authenticated users can manage activations
      - Anyone can read activations
    
  Note: Uses IF NOT EXISTS checks to prevent errors if policies already exist
*/

-- Enable RLS (this is idempotent, won't error if already enabled)
ALTER TABLE activations ENABLE ROW LEVEL SECURITY;

-- Add policies if they don't exist
DO $$ 
BEGIN
    -- Check and create the authenticated users policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'activations' 
        AND policyname = 'Allow authenticated users to manage activations'
    ) THEN
        CREATE POLICY "Allow authenticated users to manage activations"
            ON activations
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;

    -- Check and create the public read access policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'activations' 
        AND policyname = 'Allow public read access to activations'
    ) THEN
        CREATE POLICY "Allow public read access to activations"
            ON activations
            FOR SELECT
            TO public
            USING (true);
    END IF;
END $$;