-- Position(s) of focus for the printed report card: one primary position
-- plus up to two supporting positions the coach wants highlighted. Free-text
-- rather than an enum so a coach can note something like "SS" even for a
-- kid who mostly pitches, without a schema change.
ALTER TABLE public.report_cards
  ADD COLUMN position_primary TEXT,
  ADD COLUMN position_support_1 TEXT,
  ADD COLUMN position_support_2 TEXT;
