ALTER TABLE public.workout_assignments
  ADD COLUMN IF NOT EXISTS is_catch_up boolean NOT NULL DEFAULT false;