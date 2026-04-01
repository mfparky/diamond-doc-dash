-- Fix workout photo upload: the existing upload policy requires the first
-- path segment to match auth.uid(), but workout photos are stored under
-- workouts/{pitcherId}/... which fails that check.
-- Add a separate policy that allows any authenticated user to upload to
-- the workouts/ prefix.

CREATE POLICY "Authenticated users can upload workout photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'outing-videos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'workouts'
);

-- Allow authenticated users to update workout photos (e.g. replace)
CREATE POLICY "Authenticated users can update workout photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'outing-videos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'workouts'
);

-- Allow authenticated users to delete workout photos
CREATE POLICY "Authenticated users can delete workout photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'outing-videos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'workouts'
);
