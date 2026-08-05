-- Phase 1 (multi-team hardening): close the confirmed cross-team data leak.
--
-- Migration 20260204044538 (and 20260401042158, 20260513150354,
-- 20260513164834) added fully public `USING (true)` SELECT policies on
-- pitchers/outings/pitch_locations/teams/games/game_pitches/user_approvals.
-- Because Postgres OR's multiple permissive policies together, these public
-- policies mean ANY signed-in or anonymous caller can currently read every
-- team's roster and pitch data directly through the Supabase client,
-- regardless of the team-scoped policies added alongside them. This
-- migration removes that hole.
--
-- Four of these tables (pitchers, outings, pitch_locations, teams) are
-- genuinely read by public, no-login parent/team dashboard routes
-- (/player/:playerId, /team/:teamId, /team/:teamId/wall, /dashboard/:userId)
-- — dropping their public policies outright would break those routes for
-- the one real live team. So this migration pairs each drop with a narrow,
-- SECURITY DEFINER RPC that returns only the one team's/pitcher's/user's
-- rows for the id already present in the URL, and the matching frontend
-- pages are updated in the same change to call the RPC instead of the raw
-- table. `games`/`game_pitches` have no public route depending on them, so
-- those are dropped with no replacement. `user_approvals`' public policy
-- leaked every user's email + approval status to anon for no reason
-- `checkApproval()` ever needs unauthenticated access — replaced with a
-- self-only authenticated policy.
--
-- workout_assignments / workout_completions are intentionally NOT touched
-- here — they're used by the parent-facing workout accountability flow
-- across many call sites and need a dedicated pass (tracked as a follow-up)
-- to move to the same RPC pattern before their public policies can be
-- safely dropped.

-- ── 1. Step 1a/1b prerequisite: auto-fill team_id on write ─────────────────
-- Makes team_id correctness a DB guarantee instead of relying on every
-- insert call site remembering to pass it. Runs BEFORE the app-level fixes
-- take effect for any row the client didn't stamp itself.
CREATE OR REPLACE FUNCTION public.set_team_id_from_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.team_id IS NULL THEN
    SELECT tm.team_id INTO NEW.team_id
    FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
    ORDER BY (tm.role = 'owner') DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pitchers_set_team_id ON public.pitchers;
CREATE TRIGGER trg_pitchers_set_team_id
  BEFORE INSERT ON public.pitchers
  FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_membership();

DROP TRIGGER IF EXISTS trg_outings_set_team_id ON public.outings;
CREATE TRIGGER trg_outings_set_team_id
  BEFORE INSERT ON public.outings
  FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_membership();

DROP TRIGGER IF EXISTS trg_pitch_locations_set_team_id ON public.pitch_locations;
CREATE TRIGGER trg_pitch_locations_set_team_id
  BEFORE INSERT ON public.pitch_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_membership();

-- ── 2. Backfill any remaining NULL team_id rows for the live team ──────────
-- Same idempotent pattern as 20260406040703: only touches rows already
-- owned by that team's known owner, and only where team_id is still NULL.
DO $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT id INTO v_team_id FROM public.teams
  WHERE owner_id = '4abbcae7-09d7-4c29-a493-cabf5c91d1a1'
  LIMIT 1;

  IF v_team_id IS NOT NULL THEN
    UPDATE public.pitchers SET team_id = v_team_id
      WHERE team_id IS NULL AND user_id = '4abbcae7-09d7-4c29-a493-cabf5c91d1a1';
    UPDATE public.outings SET team_id = v_team_id
      WHERE team_id IS NULL AND user_id = '4abbcae7-09d7-4c29-a493-cabf5c91d1a1';
    UPDATE public.pitch_locations SET team_id = v_team_id
      WHERE team_id IS NULL AND user_id = '4abbcae7-09d7-4c29-a493-cabf5c91d1a1';
  END IF;
END $$;

-- ── 3. Narrow public-read RPCs (replace the public policies below) ─────────

CREATE OR REPLACE FUNCTION public.get_public_team_info(p_team_id uuid)
RETURNS TABLE (
  id uuid, name text, design_system text,
  leaderboard_from date, leaderboard_to date,
  achievement_from date, achievement_to date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.name, t.design_system, t.leaderboard_from, t.leaderboard_to,
         t.achievement_from, t.achievement_to
  FROM public.teams t
  WHERE t.id = p_team_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_team_pitchers(p_team_id uuid)
RETURNS SETOF public.pitchers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.pitchers WHERE team_id = p_team_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_pitcher(p_pitcher_id uuid)
RETURNS SETOF public.pitchers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.pitchers WHERE id = p_pitcher_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_user_pitchers(p_user_id uuid)
RETURNS SETOF public.pitchers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.pitchers WHERE user_id = p_user_id AND team_id IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_public_team_outings(p_team_id uuid)
RETURNS SETOF public.outings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.outings WHERE team_id = p_team_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_user_outings(p_user_id uuid)
RETURNS SETOF public.outings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.outings WHERE user_id = p_user_id AND team_id IS NULL;
$$;

-- Scoped by the pitcher's own team_id/user_id boundary (via join), not a
-- blind name match — closes the same-named-pitcher-across-teams crossover
-- bug (Phase 2) ahead of schedule for this one read path.
CREATE OR REPLACE FUNCTION public.get_public_pitcher_outings(p_pitcher_id uuid)
RETURNS SETOF public.outings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.*
  FROM public.outings o
  JOIN public.pitchers p ON p.name = o.pitcher_name
    AND (
      (p.team_id IS NOT NULL AND p.team_id = o.team_id)
      OR (p.team_id IS NULL AND p.user_id IS NOT NULL AND p.user_id = o.user_id)
    )
  WHERE p.id = p_pitcher_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_pitcher_pitch_locations(p_pitcher_id uuid)
RETURNS SETOF public.pitch_locations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.pitch_locations WHERE pitcher_id = p_pitcher_id::text;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_team_info(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_team_pitchers(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_pitcher(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_user_pitchers(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_team_outings(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_user_outings(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_pitcher_outings(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_pitcher_pitch_locations(uuid) TO anon, authenticated;

-- ── 4. Drop the leaky public policies ───────────────────────────────────────

DROP POLICY IF EXISTS "Public can view pitchers by id" ON public.pitchers;
DROP POLICY IF EXISTS "Public can view outings by pitcher" ON public.outings;
DROP POLICY IF EXISTS "Public can view pitch_locations by pitcher" ON public.pitch_locations;
DROP POLICY IF EXISTS "Public can view team leaderboard dates" ON public.teams;

-- No public route depends on these — safe to drop outright.
DROP POLICY IF EXISTS "Public can view games" ON public.games;
DROP POLICY IF EXISTS "Public can view game_pitches" ON public.game_pitches;

-- user_approvals: checkApproval() is only ever called with an authenticated
-- session (post sign-in, or from the auth-state listener for an existing
-- session), never anonymously — so this can be narrowed to self-only
-- without breaking anything, closing a full email+status leak.
DROP POLICY IF EXISTS "Anyone can check approval" ON public.user_approvals;
CREATE POLICY "Users can check their own approval status"
  ON public.user_approvals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
