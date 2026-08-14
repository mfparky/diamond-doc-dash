-- 1. Report cards: replace blanket public read with a scoped, single-player RPC.
DROP POLICY IF EXISTS "Public can read published report cards" ON public.report_cards;

CREATE OR REPLACE FUNCTION public.get_published_report_card(p_pitcher_id uuid)
RETURNS TABLE (
  id uuid,
  period_start date,
  period_end date,
  narrative_summary text,
  narrative_strengths text,
  narrative_areas text,
  tryout_focus text,
  position_primary text,
  position_support_1 text,
  position_support_2 text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rc.id, rc.period_start, rc.period_end,
         rc.narrative_summary, rc.narrative_strengths, rc.narrative_areas,
         rc.tryout_focus, rc.position_primary, rc.position_support_1, rc.position_support_2
  FROM public.report_cards rc
  WHERE rc.pitcher_id = p_pitcher_id
    AND rc.published = true
  ORDER BY rc.period_end DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_published_report_card(uuid) TO anon, authenticated;

-- 2. Team helper functions: declare explicitly in migration history.
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND _team_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND _team_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'owner'
  );
$$;

-- 3. Tighten anonymous workout photo uploads: must target workouts/<existing pitcher id>/
CREATE OR REPLACE FUNCTION public.is_valid_workout_upload_path(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  parts text[];
  pid uuid;
BEGIN
  parts := storage.foldername(_name);
  IF array_length(parts, 1) < 2 OR parts[1] <> 'workouts' THEN
    RETURN false;
  END IF;
  BEGIN
    pid := parts[2]::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  RETURN EXISTS (SELECT 1 FROM public.pitchers WHERE id = pid);
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_workout_upload_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_workout_upload_path(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can upload workout photos" ON storage.objects;

CREATE POLICY "Workout photo uploads must target a real pitcher folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'outing-videos'
  AND public.is_valid_workout_upload_path(name)
);

-- 4. Lock down SECURITY DEFINER functions that require a signed-in user.
REVOKE EXECUTE ON FUNCTION public.create_team(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_team_by_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_team_memberships() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_own_team_join_code(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_team_member(uuid) FROM anon;

-- Trigger helpers should never be callable directly through the API.
REVOKE EXECUTE ON FUNCTION public.set_outing_pitcher_uuid() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_team_id_from_membership() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;