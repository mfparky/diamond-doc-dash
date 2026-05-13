ALTER TABLE public.game_pitches
  ADD COLUMN IF NOT EXISTS is_opponent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opponent_jersey text;

ALTER TABLE public.game_pitches ALTER COLUMN pitcher_id DROP NOT NULL;