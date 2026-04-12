-- Delete the 3 extra BONUS WORKOUT 1 completions for Nico (keep 4b5b487d which has the photo)
DELETE FROM public.workout_completions
WHERE id IN (
  '626880a3-e0d0-4dff-9c45-e02fc9e12895',
  'a00ff5f8-f78b-4a37-9a88-85b861517d8f',
  'c7dba429-f3ac-48dc-80fb-c784ba23faaf'
);

-- Fix frequency to 1 for Nico's BONUS WORKOUT 1 assignment
UPDATE public.workout_assignments
SET frequency = 1
WHERE id = '4c16e55f-3eee-4e60-b9d1-111de304fe8d';