-- Create storage bucket for room logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('public', 'Public Storage', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the public bucket with IF NOT EXISTS checks
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Public Read Access for Public Bucket'
  ) THEN
    CREATE POLICY "Public Read Access for Public Bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'public');
  END IF;

  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Authenticated Users can Upload to Public Bucket'
  ) THEN
    CREATE POLICY "Authenticated Users can Upload to Public Bucket"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'public');
  END IF;

  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Users can Update Their Public Files'
  ) THEN
    CREATE POLICY "Users can Update Their Public Files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'public' AND auth.uid() = owner)
    WITH CHECK (bucket_id = 'public');
  END IF;

  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Users can Delete Their Public Files'
  ) THEN
    CREATE POLICY "Users can Delete Their Public Files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'public' AND auth.uid() = owner);
  END IF;
END $$;

-- Add function to update room theme settings
CREATE OR REPLACE FUNCTION update_room_theme(
  p_room_id uuid,
  p_primary_color text,
  p_secondary_color text,
  p_background_color text,
  p_text_color text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update room theme
  UPDATE rooms
  SET theme = jsonb_build_object(
    'primary_color', p_primary_color,
    'secondary_color', p_secondary_color,
    'background_color', p_background_color,
    'text_color', p_text_color
  )
  WHERE id = p_room_id;
  
  RETURN FOUND;
END;
$$;

-- Add function to update room logo
CREATE OR REPLACE FUNCTION update_room_logo(
  p_room_id uuid,
  p_logo_url text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update room logo
  UPDATE rooms
  SET logo_url = p_logo_url
  WHERE id = p_room_id;
  
  RETURN FOUND;
END;
$$;

-- Add function to apply room theme to all templates
CREATE OR REPLACE FUNCTION apply_room_theme_to_templates(
  p_room_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room record;
  v_count integer := 0;
BEGIN
  -- Get room data
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Update all templates for this room
  UPDATE activations
  SET theme = v_room.theme
  WHERE room_id = p_room_id
  AND is_template = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;