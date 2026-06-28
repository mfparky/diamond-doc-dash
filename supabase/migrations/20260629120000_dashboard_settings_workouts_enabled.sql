-- Per-coach toggle for the workouts feature surface (leaderboard, counts,
-- accountability widgets, BottomNav slot). Defaults true so existing coaches
-- see no change after the migration.
ALTER TABLE public.dashboard_settings
  ADD COLUMN IF NOT EXISTS workouts_enabled BOOLEAN NOT NULL DEFAULT true;
