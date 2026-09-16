-- Season rollover support: coaches previously had only a hard DELETE to
-- remove a departed player from the roster, which cascades (pitchers has
-- ON DELETE CASCADE from pitcher_stat_snapshots and report_cards) and
-- destroys their history — and breaks any public /player/:id link a
-- parent had saved, since get_public_pitcher would have nothing left to
-- return. `active` lets a coach archive a player instead: they drop off
-- the current roster and out of team-wide public views, but the row,
-- their full history, and their existing public link all keep working
-- exactly as before. Defaults true so every existing pitcher stays on the
-- active roster with no behavior change until a coach explicitly archives
-- someone.
ALTER TABLE public.pitchers
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Team-wide / "current roster" public views should only show the active
-- roster — no return-shape change (still SETOF public.pitchers), so no
-- DROP FUNCTION needed, just the added filter.
CREATE OR REPLACE FUNCTION public.get_public_team_pitchers(p_team_id uuid)
RETURNS SETOF public.pitchers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.pitchers WHERE team_id = p_team_id AND active = true;
$$;

CREATE OR REPLACE FUNCTION public.get_public_user_pitchers(p_user_id uuid)
RETURNS SETOF public.pitchers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.pitchers WHERE user_id = p_user_id AND team_id IS NULL AND active = true;
$$;

-- get_public_pitcher (single player, by id) is deliberately left
-- untouched — no active filter. That's the whole point: a parent's saved
-- link must keep resolving to the same player's page after they're
-- archived off the active roster.
