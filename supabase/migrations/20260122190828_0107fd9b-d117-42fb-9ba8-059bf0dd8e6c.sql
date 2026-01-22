-- Update event_type constraint to use "External" instead of "Live ABs"
ALTER TABLE public.outings DROP CONSTRAINT IF EXISTS outings_event_type_check;
ALTER TABLE public.outings ADD CONSTRAINT outings_event_type_check 
  CHECK (event_type IN ('Bullpen', 'External', 'Game', 'Practice'));

-- Update existing "Live ABs" records to "External"
UPDATE public.outings SET event_type = 'External' WHERE event_type = 'Live ABs';