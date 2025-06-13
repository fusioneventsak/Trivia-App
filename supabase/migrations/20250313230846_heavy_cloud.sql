/*
  # Storage Configuration for Media Uploads
  
  1. New Storage Buckets
    - Create a storage bucket for activations media
  
  2. Storage Policies
    - Setup access policies for the bucket
*/

-- Create storage bucket for activations if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('activations', 'activations')
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the activations bucket

-- Allow anyone to view images in the activations bucket
CREATE POLICY "Public Read Access for Activations Media"
ON storage.objects FOR SELECT
USING (bucket_id = 'activations');

-- Allow authenticated users to upload to the activations bucket
CREATE POLICY "Authenticated Users can Upload Activations Media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'activations');

-- Allow users to update their own uploaded media
CREATE POLICY "Users can Update Their Activations Media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'activations' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'activations');

-- Allow users to delete their own uploaded media
CREATE POLICY "Users can Delete Their Activations Media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'activations' AND auth.uid() = owner);