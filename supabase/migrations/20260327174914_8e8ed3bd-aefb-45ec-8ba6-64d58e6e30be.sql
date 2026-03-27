ALTER TABLE public.workout_assignments
  ADD COLUMN frequency integer NOT NULL DEFAULT 7,
  ADD COLUMN attachment_url text;