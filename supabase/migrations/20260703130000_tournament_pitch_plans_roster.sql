-- Per-tournament roster: coaches may pick up players who aren't on the main
-- app roster, and may leave some regulars off a specific tournament plan.
-- Stored as JSONB so we don't need to add pitcher-side plumbing.
--
-- Shape: [{ id: string, name: string, isPickup: boolean }, ...]
--   - id is either a real pitchers.id (for main-roster players) or a generated
--     'pu_...' id for pickups. IDs are used as the row key in the entries map,
--     so they must be unique within a plan.
--   - isPickup marks players who don't exist in the pitchers table.
ALTER TABLE public.tournament_pitch_plans
  ADD COLUMN roster JSONB NOT NULL DEFAULT '[]'::jsonb;
