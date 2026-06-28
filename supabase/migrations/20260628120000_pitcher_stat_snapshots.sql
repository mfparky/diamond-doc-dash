-- Create table for pitcher stat snapshots uploaded from external sources
-- (e.g., GameChanger season-stat CSV exports). One row per pitcher per upload,
-- so trending across uploads is just an ORDER BY uploaded_at.
CREATE TABLE public.pitcher_stat_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pitcher_id UUID NOT NULL REFERENCES public.pitchers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source_filename TEXT,
  -- Parsed and section-namespaced stats (e.g., bat_avg, pit_era, field_fpct).
  -- Stored as JSONB so adding stat columns later doesn't need a migration.
  stats JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Fastest query: "latest N snapshots for this pitcher"
CREATE INDEX idx_pitcher_stat_snapshots_pitcher_uploaded
  ON public.pitcher_stat_snapshots (pitcher_id, uploaded_at DESC);

CREATE INDEX idx_pitcher_stat_snapshots_user
  ON public.pitcher_stat_snapshots (user_id);

ALTER TABLE public.pitcher_stat_snapshots ENABLE ROW LEVEL SECURITY;

-- Coach-only scope per the feature design: a coach only sees the snapshots
-- they uploaded. No parent-facing read path in v1.
CREATE POLICY "Coaches view their own snapshots"
  ON public.pitcher_stat_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Coaches insert their own snapshots"
  ON public.pitcher_stat_snapshots
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coaches delete their own snapshots"
  ON public.pitcher_stat_snapshots
  FOR DELETE
  USING (auth.uid() = user_id);
-- Snapshots are immutable on purpose. Coaches re-upload to refresh data
-- rather than mutating an existing snapshot, so no UPDATE policy.
