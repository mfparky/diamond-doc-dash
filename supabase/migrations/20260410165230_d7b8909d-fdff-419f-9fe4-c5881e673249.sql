-- Insert BONUS WORKOUT 1 assignments for the 4 players (expired)
INSERT INTO public.workout_assignments (pitcher_id, title, description, frequency, expires_at, team_id, user_id)
VALUES
  ('37abd7ad-1bc4-4dec-af83-8d4a703f632c', 'BONUS WORKOUT 1', NULL, 7, '2025-04-10T02:00:00+00:00', 'df9e0d02-60e2-4379-906e-ddcc5e404fec', '4abbcae7-09d7-4c29-a493-cabf5c91d1a1'),
  ('d81ee310-4daf-4612-b166-426cb95abbe0', 'BONUS WORKOUT 1', NULL, 7, '2025-04-10T02:00:00+00:00', 'df9e0d02-60e2-4379-906e-ddcc5e404fec', '4abbcae7-09d7-4c29-a493-cabf5c91d1a1'),
  ('a333a663-2383-4b5b-bdb4-8243338f3675', 'BONUS WORKOUT 1', NULL, 7, '2025-04-10T02:00:00+00:00', 'df9e0d02-60e2-4379-906e-ddcc5e404fec', '4abbcae7-09d7-4c29-a493-cabf5c91d1a1'),
  ('b51454be-c6c0-428c-b677-57723642aab9', 'BONUS WORKOUT 1', NULL, 7, '2025-04-10T02:00:00+00:00', 'df9e0d02-60e2-4379-906e-ddcc5e404fec', '4abbcae7-09d7-4c29-a493-cabf5c91d1a1');

-- Insert completions for each player (week of April 7, day 2 = Wednesday)
INSERT INTO public.workout_completions (assignment_id, pitcher_id, week_start, day_of_week)
SELECT id, pitcher_id, '2025-04-07', 2
FROM public.workout_assignments
WHERE title = 'BONUS WORKOUT 1' AND expires_at = '2025-04-10T02:00:00+00:00';