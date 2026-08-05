-- Phase 2 follow-up: closes a regression that surfaced while working on
-- Phase 2. `src/components/CombinedDashboard.tsx` — rendered inside the
-- public TeamDashboard/CoachDashboard routes via a `parentMode` prop —
-- makes its own raw `pitchers`/`teams`/`pitch_locations` selects that
-- weren't caught in Phase 1's page-level RPC migration. Now that Phase 1
-- dropped the public policies those queries relied on, they'd silently
-- return empty for anonymous parent-dashboard viewers. Add narrow RPCs to
-- cover them, same pattern as Phase 1's get_public_* functions.

-- Team's pitch locations within a date range, joined through pitchers so
-- results are strictly bounded to that team — used by the parent-mode
-- location heatmap on /team/:teamId.
CREATE OR REPLACE FUNCTION public.get_public_team_pitch_locations(
  p_team_id uuid, p_start timestamptz, p_end timestamptz
)
RETURNS SETOF public.pitch_locations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pl.*
  FROM public.pitch_locations pl
  JOIN public.pitchers p ON p.id::text = pl.pitcher_id
  WHERE p.team_id = p_team_id
    AND pl.created_at >= p_start
    AND pl.created_at <= p_end;
$$;

-- Same, for the legacy solo-coach path (/dashboard/:userId — no team_id).
CREATE OR REPLACE FUNCTION public.get_public_user_pitch_locations(
  p_user_id uuid, p_start timestamptz, p_end timestamptz
)
RETURNS SETOF public.pitch_locations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pl.*
  FROM public.pitch_locations pl
  JOIN public.pitchers p ON p.id::text = pl.pitcher_id
  WHERE p.team_id IS NULL
    AND p.user_id = p_user_id
    AND pl.created_at >= p_start
    AND pl.created_at <= p_end;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_team_pitch_locations(uuid, timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_user_pitch_locations(uuid, timestamptz, timestamptz) TO anon, authenticated;
