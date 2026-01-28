-- Fix RLS policies to prevent data exposure when team_id is NULL
-- Instead of allowing anyone to see NULL team_id records, require user_id ownership

-- =====================
-- PITCHERS TABLE
-- =====================
DROP POLICY IF EXISTS "Team members can view pitchers" ON public.pitchers;
CREATE POLICY "Team members can view pitchers"
  ON public.pitchers FOR SELECT
  USING (
    is_team_member(auth.uid(), team_id)
    OR (team_id IS NULL AND user_id = auth.uid())
  );

-- =====================
-- OUTINGS TABLE
-- =====================
DROP POLICY IF EXISTS "Team members can view outings" ON public.outings;
CREATE POLICY "Team members can view outings"
  ON public.outings FOR SELECT
  USING (
    is_team_member(auth.uid(), team_id)
    OR (team_id IS NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Team members can update outings" ON public.outings;
CREATE POLICY "Team members can update outings"
  ON public.outings FOR UPDATE
  USING (
    is_team_member(auth.uid(), team_id)
    OR (team_id IS NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Team owners can delete outings" ON public.outings;
CREATE POLICY "Team owners can delete outings"
  ON public.outings FOR DELETE
  USING (
    is_team_owner(auth.uid(), team_id)
    OR (team_id IS NULL AND user_id = auth.uid())
  );

-- =====================
-- PITCH_LOCATIONS TABLE
-- =====================
DROP POLICY IF EXISTS "Team members can view pitch_locations" ON public.pitch_locations;
CREATE POLICY "Team members can view pitch_locations"
  ON public.pitch_locations FOR SELECT
  USING (
    is_team_member(auth.uid(), team_id)
    OR (team_id IS NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Team members can update pitch_locations" ON public.pitch_locations;
CREATE POLICY "Team members can update pitch_locations"
  ON public.pitch_locations FOR UPDATE
  USING (
    is_team_member(auth.uid(), team_id)
    OR (team_id IS NULL AND user_id = auth.uid())
  );