ALTER TABLE public.game_pitches
  ADD COLUMN IF NOT EXISTS outcome text;

-- Backfill from existing is_strike for old rows
UPDATE public.game_pitches
SET outcome = CASE WHEN is_strike THEN 'strike' ELSE 'ball' END
WHERE outcome IS NULL;