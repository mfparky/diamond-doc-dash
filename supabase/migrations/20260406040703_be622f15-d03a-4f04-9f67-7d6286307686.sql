
DO $$
DECLARE
  v_team_id uuid;
BEGIN
  -- Create the Hawks 12U AA team
  INSERT INTO public.teams (name, owner_id)
  VALUES ('Hawks 12U AA', '4abbcae7-09d7-4c29-a493-cabf5c91d1a1')
  RETURNING id INTO v_team_id;

  -- Add the owner as a team member
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (v_team_id, '4abbcae7-09d7-4c29-a493-cabf5c91d1a1', 'owner');

  -- Assign all pitchers
  UPDATE public.pitchers
  SET team_id = v_team_id
  WHERE user_id = '4abbcae7-09d7-4c29-a493-cabf5c91d1a1'
    AND team_id IS NULL;

  -- Assign all outings
  UPDATE public.outings
  SET team_id = v_team_id
  WHERE user_id = '4abbcae7-09d7-4c29-a493-cabf5c91d1a1'
    AND team_id IS NULL;

  -- Assign all pitch_locations
  UPDATE public.pitch_locations
  SET team_id = v_team_id
  WHERE user_id = '4abbcae7-09d7-4c29-a493-cabf5c91d1a1'
    AND team_id IS NULL;

  -- Assign all workout_assignments
  UPDATE public.workout_assignments
  SET team_id = v_team_id
  WHERE user_id = '4abbcae7-09d7-4c29-a493-cabf5c91d1a1'
    AND team_id IS NULL;
END $$;
