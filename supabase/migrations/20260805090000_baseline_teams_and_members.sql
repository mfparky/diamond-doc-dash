-- Phase 0 (multi-team hardening): document the "teams" and "team_members"
-- tables that already exist live but were never captured in a tracked
-- migration. Every statement here is guarded to be a no-op wherever these
-- objects already exist (i.e. on production) — this file only brings a
-- FRESH database (local dev, CI) up to parity with production, it never
-- alters production's real objects.
--
-- Column shapes below are reverse-engineered from src/integrations/supabase/types.ts,
-- the generated client types that mirror the live schema, cross-checked against
-- every migration that already references these tables by name.
--
-- teams.owner_id's REFERENCES auth.users(id) was missing from the original
-- version of this file (discovered live during Phase 6, when seeding a fake
-- owner_id in the isolation test hit a real FK violation production
-- actually enforces) — added for accuracy. Still a no-op on production
-- either way, since CREATE TABLE IF NOT EXISTS never touches an existing
-- table's constraints.

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  join_code text NOT NULL DEFAULT substr(md5(random()::text), 1, 6),
  design_system text,
  achievement_from date,
  achievement_to date,
  leaderboard_from date,
  leaderboard_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- NOTE: a UNIQUE(team_id, user_id) constraint on team_members is added in
-- Phase 3's migration, not here — adding a constraint to a table that
-- already has live data requires first checking for duplicate rows, which
-- belongs with the feature that depends on it (join-by-code), not this
-- no-op baseline.

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
