-- Phase 2 (multi-team hardening): outings.pitcher_id is a TEXT column that
-- holds two different, inconsistent value schemes depending on entry path —
-- a client-generated name slug (manual entry / charting flow) or the real
-- pitchers.id UUID (live game mode). Neither the stat calculations nor the
-- dashboards actually join on it; they match by pitcher_name string
-- equality instead, which is fragile (breaks on a rename/typo). This adds
-- a real FK column and backfills/auto-fills it going forward, without
-- touching the legacy pitcher_id column (kept, deprecated, unused).

ALTER TABLE public.outings
  ADD COLUMN IF NOT EXISTS pitcher_uuid uuid REFERENCES public.pitchers(id);

-- Backfill via name match, scoped to the same team_id (or the same legacy
-- user_id for un-migrated solo-coach rows) — reliable now that Phase 1
-- backfilled team_id everywhere. Only touches rows that don't already have
-- a pitcher_uuid and that resolve to exactly one pitcher, so it can never
-- mis-link an outing across teams even if two teams happen to share a
-- pitcher name.
WITH candidate_matches AS (
  SELECT o2.id AS outing_id, p.id AS pitcher_id
  FROM public.outings o2
  JOIN public.pitchers p ON p.name = o2.pitcher_name
    AND (
      (p.team_id IS NOT NULL AND p.team_id = o2.team_id)
      OR (p.team_id IS NULL AND p.user_id IS NOT NULL AND p.user_id = o2.user_id)
    )
),
unambiguous_matches AS (
  SELECT outing_id, min(pitcher_id) AS pitcher_id
  FROM candidate_matches
  GROUP BY outing_id
  HAVING count(*) = 1
)
UPDATE public.outings o
SET pitcher_uuid = m.pitcher_id
FROM unambiguous_matches m
WHERE o.id = m.outing_id
  AND o.pitcher_uuid IS NULL;

-- Auto-resolve pitcher_uuid on write for any path not yet updated to pass
-- it explicitly — same "DB guarantee, not app discipline" pattern as
-- Phase 1's set_team_id_from_membership().
CREATE OR REPLACE FUNCTION public.set_outing_pitcher_uuid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_count int;
  v_pitcher_id uuid;
BEGIN
  IF NEW.pitcher_uuid IS NULL THEN
    SELECT count(*), max(p.id) INTO v_match_count, v_pitcher_id
    FROM public.pitchers p
    WHERE p.name = NEW.pitcher_name
      AND (
        (p.team_id IS NOT NULL AND p.team_id = NEW.team_id)
        OR (p.team_id IS NULL AND p.user_id IS NOT NULL AND p.user_id = NEW.user_id)
      );

    -- Only auto-fill when the lookup is unambiguous — don't guess if more
    -- than one pitcher matches.
    IF v_match_count = 1 THEN
      NEW.pitcher_uuid := v_pitcher_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- This trigger must run AFTER Phase 1's team_id trigger, since it matches
-- pitchers using NEW.team_id. Postgres fires same-event BEFORE triggers in
-- name order, so rename Phase 1's trigger with an explicit ordering prefix
-- rather than relying on the two migrations' alphabetical filenames/names
-- to happen to sort correctly.
DROP TRIGGER IF EXISTS trg_outings_set_team_id ON public.outings;
CREATE TRIGGER trg_outings_1_set_team_id
  BEFORE INSERT ON public.outings
  FOR EACH ROW EXECUTE FUNCTION public.set_team_id_from_membership();

DROP TRIGGER IF EXISTS trg_outings_set_pitcher_uuid ON public.outings;
CREATE TRIGGER trg_outings_2_set_pitcher_uuid
  BEFORE INSERT ON public.outings
  FOR EACH ROW EXECUTE FUNCTION public.set_outing_pitcher_uuid();
