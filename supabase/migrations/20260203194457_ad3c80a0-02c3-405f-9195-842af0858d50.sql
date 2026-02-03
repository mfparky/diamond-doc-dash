-- Create table for workout templates (assigned by coaches)
CREATE TABLE public.workout_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pitcher_id UUID NOT NULL REFERENCES public.pitchers(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for workout completions (marked by parents)
CREATE TABLE public.workout_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.workout_assignments(id) ON DELETE CASCADE,
  pitcher_id UUID NOT NULL REFERENCES public.pitchers(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- Monday of the week
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Mon, 6=Sun
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, week_start, day_of_week)
);

-- Enable RLS
ALTER TABLE public.workout_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_completions ENABLE ROW LEVEL SECURITY;

-- RLS for workout_assignments (coaches can manage, public can view for their pitcher)
CREATE POLICY "Team members can view workout_assignments"
ON public.workout_assignments FOR SELECT
USING (is_team_member(auth.uid(), team_id) OR (team_id IS NULL AND user_id = auth.uid()));

CREATE POLICY "Team members can create workout_assignments"
ON public.workout_assignments FOR INSERT
WITH CHECK ((team_id IS NOT NULL AND is_team_member(auth.uid(), team_id)) OR (team_id IS NULL AND user_id = auth.uid()));

CREATE POLICY "Team members can update workout_assignments"
ON public.workout_assignments FOR UPDATE
USING (is_team_member(auth.uid(), team_id) OR (team_id IS NULL AND user_id = auth.uid()));

CREATE POLICY "Team owners can delete workout_assignments"
ON public.workout_assignments FOR DELETE
USING (is_team_owner(auth.uid(), team_id) OR (team_id IS NULL AND user_id = auth.uid()));

-- Public read access for workout_assignments (parents viewing dashboards)
CREATE POLICY "Public can view workout_assignments by pitcher"
ON public.workout_assignments FOR SELECT
USING (true);

-- RLS for workout_completions (anyone can complete - for parents)
CREATE POLICY "Anyone can view workout_completions"
ON public.workout_completions FOR SELECT
USING (true);

CREATE POLICY "Anyone can create workout_completions"
ON public.workout_completions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update workout_completions"
ON public.workout_completions FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete workout_completions"
ON public.workout_completions FOR DELETE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_workout_assignments_updated_at
BEFORE UPDATE ON public.workout_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();