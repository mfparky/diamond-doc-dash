
-- Fix the typo: week_start 2025-04-07 should be 2026-04-07
UPDATE public.workout_completions
SET week_start = DATE '2026-04-07'
WHERE pitcher_id = '37abd7ad-1bc4-4dec-af83-8d4a703f632c'
  AND week_start = DATE '2025-04-07';

-- Bring post-window completions inside the window (window closed end of Sun 2026-05-10)
UPDATE public.workout_completions
SET created_at = TIMESTAMPTZ '2026-05-10 23:00:00+00'
WHERE pitcher_id = '37abd7ad-1bc4-4dec-af83-8d4a703f632c'
  AND created_at > TIMESTAMPTZ '2026-05-10 23:59:59+00';
