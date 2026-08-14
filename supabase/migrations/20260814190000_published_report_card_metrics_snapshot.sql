-- get_published_report_card (20260811154350) replaced the old public
-- table-read policy on report_cards with a scoped RPC — landed around the
-- same time as core_metrics_snapshot (20260814090000), so the RPC's return
-- shape never picked up the new column. Add it so the public player
-- dashboard can build its "at a glance" metrics overview from data this
-- RPC already has every right to return (the same single published row).
DROP FUNCTION IF EXISTS public.get_published_report_card(uuid);

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
  position_support_2 text,
  core_metrics_snapshot jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rc.id, rc.period_start, rc.period_end,
         rc.narrative_summary, rc.narrative_strengths, rc.narrative_areas,
         rc.tryout_focus, rc.position_primary, rc.position_support_1, rc.position_support_2,
         rc.core_metrics_snapshot
  FROM public.report_cards rc
  WHERE rc.pitcher_id = p_pitcher_id
    AND rc.published = true
  ORDER BY rc.period_end DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_published_report_card(uuid) TO anon, authenticated;
