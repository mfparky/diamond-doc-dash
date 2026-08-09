-- Self-serve team creation (Phase 3, 20260805130000) added create_team/
-- join_team_by_code, but nothing ever let a team owner see their own team's
-- join_code to actually hand it to a co-coach — the CreateOrJoinTeamDialog
-- only takes a code in, it never shows one out. This closes that gap with a
-- narrow SECURITY DEFINER read, same pattern as the get_public_* RPCs: the
-- caller supplies only what they already have (their own team id), and the
-- function decides what they're allowed to see rather than relying on a
-- table-level SELECT policy (teams has none for authenticated owners today).
--
-- Deliberately owner-only, not any team member: matches
-- ManageScorekeepersDialog's existing behavior, which already only loads
-- team data for the owner role.

CREATE OR REPLACE FUNCTION public.get_own_team_join_code(p_team_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.join_code
  FROM public.teams t
  WHERE t.id = p_team_id
    AND public.is_team_owner(auth.uid(), p_team_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_own_team_join_code(uuid) TO authenticated;
