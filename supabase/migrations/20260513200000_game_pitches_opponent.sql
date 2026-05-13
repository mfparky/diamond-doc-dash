-- Allow tracking pitches from the opposing team's pitchers in Game Mode.
-- They aren't in our pitchers table, so pitcher_id becomes nullable, and we
-- record them by jersey number with an is_opponent flag.

ALTER TABLE public.game_pitches ALTER COLUMN pitcher_id DROP NOT NULL;

ALTER TABLE public.game_pitches
  ADD COLUMN IF NOT EXISTS is_opponent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opponent_jersey TEXT;

CREATE INDEX IF NOT EXISTS idx_game_pitches_opponent
  ON public.game_pitches(game_id, opponent_jersey)
  WHERE is_opponent = TRUE;
