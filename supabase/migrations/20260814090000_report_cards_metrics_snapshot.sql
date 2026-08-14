-- Stores a point-in-time snapshot of a saved report card's core metric
-- bands (label + band only — never raw values/percentiles, which would
-- require exposing team-wide comparative data) so the public player
-- dashboard can write a short "overview" paragraph without recomputing
-- against the whole team's stats on every page load. Recomputing live
-- would also mean the wording could silently drift later as other
-- players' stats get uploaded — a report card should reflect what the
-- coach actually reviewed and published, not a moving target.
--
-- No new RLS policy needed: the existing "Public can read published
-- report cards" policy (USING (published = true)) already covers every
-- column on a published row, this one included.

ALTER TABLE public.report_cards
  ADD COLUMN IF NOT EXISTS core_metrics_snapshot jsonb;
