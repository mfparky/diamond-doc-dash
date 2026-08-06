-- Phase 6 (multi-team hardening): close crossover holes that every prior
-- "close the hole" migration missed.
--
-- A full replay of every CREATE POLICY / DROP POLICY statement across the
-- entire migration history (in filename/chronological order) turned up 11
-- unconditionally-permissive (`USING (true)` / `WITH CHECK (true)`)
-- policies on `pitchers` and `outings` that were created at various points
-- and NEVER dropped by name in any later migration — including the two
-- migrations whose entire purpose was to close exactly this kind of hole
-- (20260126164135/20260126164901's "add user isolation" pass, and Phase 1's
-- 20260805100000 "close_crossover_rls_holes"). Postgres ORs multiple
-- permissive policies together, so as long as any one of these existed
-- alongside the correctly team/user-scoped policies added later, the
-- correct policies were effectively decorative — the permissive one still
-- let any caller through.
--
-- Two generations of the bug:
--
-- 1. The very first table-creation migrations (20260119192247 for outings,
--    20260121154904 for pitchers) granted "Anyone can view/add/update/
--    delete" with no auth requirement at all (not even anon vs.
--    authenticated — literally unconditional CRUD). These were never
--    dropped by name; every later migration added new, better-scoped
--    policies alongside them instead of replacing them.
-- 2. "Public can view pitchers"/"Public can view outings"/"Public can view
--    pitch_locations" (20260126164901) suffered the same fate — Phase 1
--    only dropped the differently-named "...by id"/"...by pitcher" public
--    policies added later (20260204044538), never these.
--
-- Safe to run even if some/all of these were already removed via drift
-- (e.g. manually, outside tracked migrations) — DROP POLICY IF EXISTS is a
-- no-op in that case.

-- Generation 1: original unauthenticated CRUD-for-anyone policies.
DROP POLICY IF EXISTS "Anyone can view outings" ON public.outings;
DROP POLICY IF EXISTS "Anyone can log outings" ON public.outings;
DROP POLICY IF EXISTS "Anyone can update outings" ON public.outings;
DROP POLICY IF EXISTS "Anyone can delete outings" ON public.outings;
DROP POLICY IF EXISTS "Anyone can view pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Anyone can add pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Anyone can update pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Anyone can delete pitchers" ON public.pitchers;

-- Generation 2: public read policies missed by Phase 1.
DROP POLICY IF EXISTS "Public can view pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Public can view outings" ON public.outings;
DROP POLICY IF EXISTS "Public can view pitch_locations" ON public.pitch_locations;
