-- Coach ±nudges over the auto-computed metric bands. Shape:
--   { "<metric_key>": -2 | -1 | 0 | 1 | 2, ... }
-- Missing keys mean no adjustment. Clamping happens at write time in the app.
ALTER TABLE public.report_cards
  ADD COLUMN metric_adjustments JSONB NOT NULL DEFAULT '{}'::jsonb;
