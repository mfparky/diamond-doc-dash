ALTER TABLE public.workout_assignments
  ADD COLUMN IF NOT EXISTS requires_photo boolean DEFAULT false;
