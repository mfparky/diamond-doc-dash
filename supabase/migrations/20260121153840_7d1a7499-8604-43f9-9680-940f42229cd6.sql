-- Update event_type constraint to include "Live ABs" instead of "Live"
ALTER TABLE public.outings DROP CONSTRAINT IF EXISTS outings_event_type_check;
ALTER TABLE public.outings ADD CONSTRAINT outings_event_type_check 
  CHECK (event_type IN ('Bullpen', 'Live ABs', 'Game', 'Practice'));

-- Update existing "Live" records to "Live ABs"
UPDATE public.outings SET event_type = 'Live ABs' WHERE event_type = 'Live';