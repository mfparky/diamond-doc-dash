ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS game_id uuid;
CREATE INDEX IF NOT EXISTS idx_outings_game_id ON public.outings(game_id);