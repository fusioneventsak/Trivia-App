/*
  # Add media support to activations

  1. Changes
    - Add media_type and media_url columns to activations table
    - Update options column to store media information for each option
    - Add check constraints for valid media types
    - Convert existing options data to new format

  2. Media Types
    - Question media:
      - 'none': No media
      - 'image': Image from URL
      - 'youtube': YouTube video
      - 'gif': Animated GIF
    - Option media:
      - 'none': No media
      - 'image': Image from URL
      - 'gif': Animated GIF
*/

-- Add media columns to activations table
ALTER TABLE activations
ADD COLUMN media_type text DEFAULT 'none',
ADD COLUMN media_url text,
ADD CONSTRAINT valid_media_type CHECK (media_type IN ('none', 'image', 'youtube', 'gif'));

-- Create a function to validate options array format
CREATE OR REPLACE FUNCTION check_options_format(options jsonb)
RETURNS boolean AS $$
DECLARE
  element jsonb;
  valid_types text[] := ARRAY['none', 'image', 'gif'];
BEGIN
  -- Check if it's an array
  IF jsonb_typeof(options) != 'array' THEN
    RETURN false;
  END IF;

  -- Check each element using jsonb_array_elements
  FOR element IN 
    SELECT value FROM jsonb_array_elements(options)
  LOOP
    -- Check if element is an object
    IF jsonb_typeof(element) != 'object' THEN
      RETURN false;
    END IF;

    -- Check required fields exist
    IF NOT (
      element ? 'text' AND
      element ? 'media_type' AND
      element ? 'media_url'
    ) THEN
      RETURN false;
    END IF;

    -- Check media_type is valid
    IF NOT (element->>'media_type' = ANY(valid_types)) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Convert existing options data to new format
UPDATE activations
SET options = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'text', 
      CASE 
        WHEN jsonb_typeof(opt) = 'string' THEN opt::text
        ELSE opt->>'text'
      END,
      'media_type', 'none',
      'media_url', ''
    )
  )
  FROM jsonb_array_elements(options) opt
)
WHERE options IS NOT NULL;

-- Set default for options and add constraint
ALTER TABLE activations
ALTER COLUMN options SET DEFAULT '[]'::jsonb,
ADD CONSTRAINT options_format CHECK (check_options_format(options));