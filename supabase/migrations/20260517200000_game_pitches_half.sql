-- Track which half of the inning a pitch belongs to (top vs bottom).
-- Nullable for backward compatibility; legacy rows are treated as 'top'.
ALTER TABLE public.game_pitches
  ADD COLUMN IF NOT EXISTS half TEXT CHECK (half IN ('top', 'bot'));
