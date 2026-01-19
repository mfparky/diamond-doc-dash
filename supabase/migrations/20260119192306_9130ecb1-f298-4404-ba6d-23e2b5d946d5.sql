-- Update event_type constraint to match the form values
ALTER TABLE public.outings DROP CONSTRAINT IF EXISTS outings_event_type_check;
ALTER TABLE public.outings ADD CONSTRAINT outings_event_type_check 
  CHECK (event_type IN ('Bullpen', 'Live', 'Game', 'Practice'));