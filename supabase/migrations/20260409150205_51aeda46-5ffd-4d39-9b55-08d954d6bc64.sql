ALTER TABLE public.workout_assignments
ADD COLUMN expires_at timestamp with time zone DEFAULT NULL;