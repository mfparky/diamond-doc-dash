CREATE POLICY "Anyone can upload workout photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'outing-videos'
  AND (storage.foldername(name))[1] = 'workouts'
);