-- Stores a point-in-time snapshot of a saved report card's core metric
-- bands (label + band only — never raw values/percentiles, which would
-- require exposing team-wide comparative data) so the public player
-- dashboard can write a short "overview" paragraph without recomputing
-- against the whole team's stats on every page load. Recomputing live
-- would also mean the wording could silently drift later as other
-- players' stats get uploaded — a report card should reflect what the
-- coach actually reviewed and published, not a moving target.
--
-- Plain column add — no RLS/RPC change here. The public read path for
-- report_cards is get_published_report_card() (20260811154350), which
-- needs its own return-shape update to expose this column; see
-- 20260814190000_published_report_card_metrics_snapshot.sql.

ALTER TABLE public.report_cards
  ADD COLUMN IF NOT EXISTS core_metrics_snapshot jsonb;
