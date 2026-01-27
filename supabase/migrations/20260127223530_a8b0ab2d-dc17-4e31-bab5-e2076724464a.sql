-- Create storage bucket for outing videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'outing-videos',
  'outing-videos',
  true,
  52428800, -- 50MB limit
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
);

-- RLS policies for outing-videos bucket
-- Anyone can view videos (for player dashboards)
CREATE POLICY "Anyone can view outing videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'outing-videos');

-- Authenticated users can upload to their folder
CREATE POLICY "Users can upload outing videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'outing-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own videos
CREATE POLICY "Users can update own outing videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'outing-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own videos
CREATE POLICY "Users can delete own outing videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'outing-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add video columns to outings table
ALTER TABLE public.outings 
ADD COLUMN IF NOT EXISTS video_url_1 TEXT,
ADD COLUMN IF NOT EXISTS video_url_2 TEXT,
ADD COLUMN IF NOT EXISTS video_1_pitch_type INTEGER,
ADD COLUMN IF NOT EXISTS video_1_velocity INTEGER,
ADD COLUMN IF NOT EXISTS video_2_pitch_type INTEGER,
ADD COLUMN IF NOT EXISTS video_2_velocity INTEGER;