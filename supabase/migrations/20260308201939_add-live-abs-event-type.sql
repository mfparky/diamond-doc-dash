-- Add 'Live ABs' back to event_type constraint and increase notes length for AB JSON
ALTER TABLE public.outings DROP CONSTRAINT IF EXISTS outings_event_type_check;
ALTER TABLE public.outings ADD CONSTRAINT outings_event_type_check
  CHECK (event_type IN ('Bullpen', 'External', 'Game', 'Practice', 'Live ABs'));

-- Increase notes length limit to accommodate Live ABs JSON payload
-- (a full game's AB data can easily exceed 2000 chars)
ALTER TABLE public.outings DROP CONSTRAINT IF EXISTS outings_notes_length;
ALTER TABLE public.outings ADD CONSTRAINT outings_notes_length
  CHECK (length(notes) <= 50000);
