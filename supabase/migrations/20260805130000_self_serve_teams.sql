-- Phase 3 (multi-team hardening): self-serve team creation and join-by-code.
-- teams.join_code already exists but is completely unused by app code
-- today. This adds the uniqueness constraints self-serve join needs (with
-- an explicit duplicate check first, since these tables already have live
-- data) and two SECURITY DEFINER RPCs that are the only supported way to
-- create a team or join one — narrow, auditable write paths rather than a
-- permissive INSERT policy on teams/team_members.

-- Guard: team_members must have no duplicate (team_id, user_id) pairs
-- before the unique constraint can be added. Fails loudly rather than
-- silently corrupting anything if it ever does find duplicates.
DO $$
DECLARE
  v_dupe_count int;
BEGIN
  SELECT count(*) INTO v_dupe_count FROM (
    SELECT team_id, user_id FROM public.team_members GROUP BY team_id, user_id HAVING count(*) > 1
  ) dupes;
  IF v_dupe_count > 0 THEN
    RAISE EXCEPTION 'team_members has % duplicate (team_id, user_id) pairs — resolve manually before this migration can add the unique constraint', v_dupe_count;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_team_id_user_id_key') THEN
    ALTER TABLE public.team_members ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);
  END IF;
END $$;

-- Same check for teams.join_code (only one live team today, so this is
-- expected to be a no-op, but verify rather than assume).
DO $$
DECLARE
  v_dupe_count int;
BEGIN
  SELECT count(*) INTO v_dupe_count FROM (
    SELECT join_code FROM public.teams GROUP BY join_code HAVING count(*) > 1
  ) dupes;
  IF v_dupe_count > 0 THEN
    RAISE EXCEPTION 'teams has % duplicate join_code values — resolve manually before this migration can add the unique constraint', v_dupe_count;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_join_code_key') THEN
    ALTER TABLE public.teams ADD CONSTRAINT teams_join_code_key UNIQUE (join_code);
  END IF;
END $$;

-- Creates a new team owned by the caller, with a fresh short join code.
-- Doesn't touch or assume anything about existing teams' join_code values.
CREATE OR REPLACE FUNCTION public.create_team(p_team_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_code text;
  v_attempts int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to create a team';
  END IF;
  IF p_team_name IS NULL OR length(trim(p_team_name)) = 0 THEN
    RAISE EXCEPTION 'Team name is required';
  END IF;

  LOOP
    v_code := substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    v_attempts := v_attempts + 1;
    BEGIN
      INSERT INTO public.teams (name, owner_id, join_code)
      VALUES (trim(p_team_name), auth.uid(), v_code)
      RETURNING id INTO v_team_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 10 THEN
        RAISE EXCEPTION 'Could not generate a unique join code — try again';
      END IF;
    END;
  END LOOP;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (v_team_id, auth.uid(), 'owner');

  RETURN v_team_id;
END;
$$;

-- Joins the caller to a team by its join code — instant access, no owner
-- approval gate (confirmed product decision). ON CONFLICT DO NOTHING makes
-- re-submitting a code the caller already used a harmless no-op rather
-- than an error.
CREATE OR REPLACE FUNCTION public.join_team_by_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to join a team';
  END IF;

  SELECT id INTO v_team_id FROM public.teams WHERE join_code = trim(p_code);
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (v_team_id, auth.uid(), 'member')
  ON CONFLICT (team_id, user_id) DO NOTHING;

  RETURN v_team_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_team_by_code(text) TO authenticated;

-- Lets an owner remove a member from their own team (the "review who
-- joined via code" capability). Restricted to the calling user actually
-- owning the team the target row belongs to.
CREATE OR REPLACE FUNCTION public.remove_team_member(p_member_row_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT team_id INTO v_team_id FROM public.team_members WHERE id = p_member_row_id;
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;
  IF NOT public.is_team_owner(auth.uid(), v_team_id) THEN
    RAISE EXCEPTION 'Only the team owner can remove members';
  END IF;

  DELETE FROM public.team_members WHERE id = p_member_row_id AND role <> 'owner';
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid) TO authenticated;

-- Returns the calling user's own team memberships with team names. Needed
-- because `teams` has no tracked authenticated-read RLS policy at all (its
-- only tracked SELECT policy was the public one Phase 1 dropped) — rather
-- than assume an undocumented policy covers authenticated reads, this
-- self-scoped RPC sidesteps the question entirely: it only ever returns
-- rows for auth.uid()'s own memberships, verified server-side.
CREATE OR REPLACE FUNCTION public.get_my_team_memberships()
RETURNS TABLE (team_id uuid, team_name text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.name, tm.role
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_team_memberships() TO authenticated;
