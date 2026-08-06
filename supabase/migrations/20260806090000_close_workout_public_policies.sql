-- Phase 5 (multi-team hardening): close the last remaining public RLS
-- leaks — workout_assignments' public SELECT policy, and all four of
-- workout_completions' fully-open "Anyone can ..." policies (that table
-- had zero real access control at all: any anon or authenticated caller
-- could read/insert/update/delete every team's workout completion data).
--
-- workout_assignments keeps its existing team-scoped SELECT/INSERT/UPDATE/
-- DELETE policies untouched — coaches still manage assignments via direct
-- table access (RosterManagementDialog, use-workouts.ts's addAssignment/
-- updateAssignment/deleteAssignment). Only the public SELECT policy is
-- dropped; every remaining read (coach and parent alike) goes through the
-- narrow RPCs below instead, so the app never depended on that policy
-- staying open.
--
-- workout_completions had no team-scoped policies to fall back on at all
-- (every one of its four policies was "Anyone can ..."), so rather than
-- invent new direct-table policies, all reads AND writes for this table
-- move to SECURITY DEFINER RPCs, and all four open policies are dropped —
-- the table ends up with zero direct-access policies, reachable only
-- through the functions below (for both coach and parent callers).

CREATE OR REPLACE FUNCTION public.get_public_pitcher_workout_assignments(p_pitcher_id uuid)
RETURNS SETOF public.workout_assignments
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.workout_assignments WHERE pitcher_id = p_pitcher_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_team_workout_assignments(p_team_id uuid)
RETURNS SETOF public.workout_assignments
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT wa.*
  FROM public.workout_assignments wa
  JOIN public.pitchers p ON p.id = wa.pitcher_id
  WHERE p.team_id = p_team_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_pitcher_workout_completions(p_pitcher_id uuid)
RETURNS SETOF public.workout_completions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.workout_completions WHERE pitcher_id = p_pitcher_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_team_workout_completions(p_team_id uuid)
RETURNS SETOF public.workout_completions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT wc.*
  FROM public.workout_completions wc
  JOIN public.pitchers p ON p.id = wc.pitcher_id
  WHERE p.team_id = p_team_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_user_workout_assignments(p_user_id uuid)
RETURNS SETOF public.workout_assignments
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT wa.*
  FROM public.workout_assignments wa
  JOIN public.pitchers p ON p.id = wa.pitcher_id
  WHERE p.team_id IS NULL AND p.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_user_workout_completions(p_user_id uuid)
RETURNS SETOF public.workout_completions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT wc.*
  FROM public.workout_completions wc
  JOIN public.pitchers p ON p.id = wc.pitcher_id
  WHERE p.team_id IS NULL AND p.user_id = p_user_id;
$$;

-- Validates the assignment actually belongs to the given pitcher before
-- inserting — the only real guard this data had before was "none at all",
-- so this is already stricter than current behavior, not just a rename.
CREATE OR REPLACE FUNCTION public.mark_workout_complete(
  p_assignment_id uuid, p_pitcher_id uuid, p_week_start date, p_day_of_week int, p_notes text
)
RETURNS SETOF public.workout_completions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workout_assignments
    WHERE id = p_assignment_id AND pitcher_id = p_pitcher_id
  ) THEN
    RAISE EXCEPTION 'Assignment does not belong to this pitcher';
  END IF;

  RETURN QUERY
  INSERT INTO public.workout_completions (assignment_id, pitcher_id, week_start, day_of_week, notes)
  VALUES (p_assignment_id, p_pitcher_id, p_week_start, p_day_of_week, p_notes)
  RETURNING *;
END;
$$;

-- p_pitcher_id must match the completion's own pitcher_id — without this,
-- any caller (anon or authenticated) who obtains a completion_id could
-- delete/update ANY team's completion, since these run SECURITY DEFINER
-- with no other access control on this table.
CREATE OR REPLACE FUNCTION public.unmark_workout_complete(p_completion_id uuid, p_pitcher_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.workout_completions WHERE id = p_completion_id AND pitcher_id = p_pitcher_id;
$$;

CREATE OR REPLACE FUNCTION public.update_workout_completion_notes(p_completion_id uuid, p_pitcher_id uuid, p_notes text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.workout_completions SET notes = p_notes WHERE id = p_completion_id AND pitcher_id = p_pitcher_id;
$$;

CREATE OR REPLACE FUNCTION public.update_workout_completion_photo(p_completion_id uuid, p_pitcher_id uuid, p_photo_url text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.workout_completions SET photo_url = p_photo_url WHERE id = p_completion_id AND pitcher_id = p_pitcher_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_pitcher_workout_assignments(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_team_workout_assignments(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_pitcher_workout_completions(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_team_workout_completions(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_user_workout_assignments(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_user_workout_completions(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_workout_complete(uuid, uuid, date, int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unmark_workout_complete(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_workout_completion_notes(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_workout_completion_photo(uuid, uuid, text) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view workout_assignments by pitcher" ON public.workout_assignments;

DROP POLICY IF EXISTS "Anyone can view workout_completions" ON public.workout_completions;
DROP POLICY IF EXISTS "Anyone can create workout_completions" ON public.workout_completions;
DROP POLICY IF EXISTS "Anyone can update workout_completions" ON public.workout_completions;
DROP POLICY IF EXISTS "Anyone can delete workout_completions" ON public.workout_completions;
