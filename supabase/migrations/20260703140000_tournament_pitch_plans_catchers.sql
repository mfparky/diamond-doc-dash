-- Per-day catcher assignments: coaches mark which pitchers are catching on
-- each day so the eligibility engine blocks them from also pitching that
-- day (typical youth-baseball workload rule).
--
-- Shape: { "<dayIndex>": ["<pitcherId>", ...], ... }
-- Missing keys mean no catchers assigned for that day.
ALTER TABLE public.tournament_pitch_plans
  ADD COLUMN catchers JSONB NOT NULL DEFAULT '{}'::jsonb;
