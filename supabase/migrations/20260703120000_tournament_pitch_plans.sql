-- Coach-owned tournament pitch-count plans. One row per (coach, tournament).
-- `entries` is a JSONB dictionary keyed by "<pitcherId>:<slotId>" with a
-- { planned, actual } payload — flexible enough that we don't have to
-- migrate schema every time the tournament schedule shifts.
-- `schedule` snapshots the game slots so a saved plan still renders even if
-- the app-side constant later changes.
CREATE TABLE public.tournament_pitch_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tournament_slug TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  entries JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, tournament_slug)
);

CREATE INDEX idx_tournament_pitch_plans_user
  ON public.tournament_pitch_plans (user_id, tournament_slug);

ALTER TABLE public.tournament_pitch_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage their own tournament plans"
  ON public.tournament_pitch_plans
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_tournament_pitch_plans_updated_at
BEFORE UPDATE ON public.tournament_pitch_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
