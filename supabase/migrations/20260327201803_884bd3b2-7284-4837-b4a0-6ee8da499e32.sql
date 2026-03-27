UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
WHERE id = 'outing-videos'