-- Design system deep-dive: per-team brand color customization, layered on
-- top of the (now sole) Athlete design system. A team's accent color is
-- suggested automatically from their uploaded logo (client-side extraction,
-- see src/lib/logo-color-extraction.ts) and can be overridden manually by
-- the coach — this column stores whichever value they end up with. NULL
-- means "use Athlete's default volt-green accent."
--
-- Deliberately narrow in scope: only the accent color is customized per
-- team. Backgrounds/surfaces/text/status colors (Ready=green/Caution=
-- yellow/Rest=red) stay fixed across every team — a coach needs red to
-- always mean "rest" regardless of whose colors are showing elsewhere on
-- the page.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS brand_color text;

-- CREATE OR REPLACE can't change a function's return-row shape (adding
-- brand_color to the existing 8-column return type here), so the prior
-- signature must be dropped explicitly first (same issue hit in
-- 20260806100000 when logo_url was added).
DROP FUNCTION IF EXISTS public.get_public_team_info(uuid);

CREATE OR REPLACE FUNCTION public.get_public_team_info(p_team_id uuid)
RETURNS TABLE (
  id uuid, name text, design_system text, logo_url text, brand_color text,
  leaderboard_from date, leaderboard_to date,
  achievement_from date, achievement_to date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.name, t.design_system, t.logo_url, t.brand_color,
         t.leaderboard_from, t.leaderboard_to,
         t.achievement_from, t.achievement_to
  FROM public.teams t
  WHERE t.id = p_team_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_team_info(uuid) TO anon, authenticated;
