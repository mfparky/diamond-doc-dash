-- Coach-authored note on what a player should work on for fall tryouts.
-- Printed alongside a fixed, non-editable preamble (baked into the app,
-- not stored here) making clear no roster spots are held.
ALTER TABLE public.report_cards
  ADD COLUMN tryout_focus TEXT;
