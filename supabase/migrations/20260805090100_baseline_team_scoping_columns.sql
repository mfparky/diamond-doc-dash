-- Phase 0 (multi-team hardening): document team_id columns that already
-- exist live on these tables but were never captured in a tracked
-- migration. ADD COLUMN IF NOT EXISTS is a no-op on production (column is
-- already there); this only brings a fresh database up to parity.

ALTER TABLE public.pitchers
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);

ALTER TABLE public.outings
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);

ALTER TABLE public.pitch_locations
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);

ALTER TABLE public.workout_assignments
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);
