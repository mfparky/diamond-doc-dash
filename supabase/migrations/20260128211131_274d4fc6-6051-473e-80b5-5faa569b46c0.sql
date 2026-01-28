-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE DEFAULT SUBSTRING(MD5(gen_random_uuid()::text) FROM 1 FOR 8),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_members table to link users to teams
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Add team_id to pitchers table
ALTER TABLE public.pitchers ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- Add team_id to outings table  
ALTER TABLE public.outings ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- Add team_id to pitch_locations table
ALTER TABLE public.pitch_locations ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to check team membership
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
  )
$$;

-- Security definer function to check if user is team owner
CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'owner'
  )
$$;

-- Teams RLS policies
CREATE POLICY "Team members can view their teams"
ON public.teams FOR SELECT
USING (public.is_team_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create teams"
ON public.teams FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Team owners can update their teams"
ON public.teams FOR UPDATE
USING (public.is_team_owner(auth.uid(), id));

CREATE POLICY "Team owners can delete their teams"
ON public.teams FOR DELETE
USING (public.is_team_owner(auth.uid(), id));

-- Team members RLS policies
CREATE POLICY "Team members can view team membership"
ON public.team_members FOR SELECT
USING (public.is_team_member(auth.uid(), team_id));

CREATE POLICY "Team owners can manage members"
ON public.team_members FOR INSERT
WITH CHECK (
  public.is_team_owner(auth.uid(), team_id) OR 
  (auth.uid() = user_id AND role = 'member')
);

CREATE POLICY "Team owners can update members"
ON public.team_members FOR UPDATE
USING (public.is_team_owner(auth.uid(), team_id));

CREATE POLICY "Team owners can remove members"
ON public.team_members FOR DELETE
USING (public.is_team_owner(auth.uid(), team_id) OR auth.uid() = user_id);

-- Update pitchers RLS to include team access
DROP POLICY IF EXISTS "Public can view pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Users can create own pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Users can update own pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Users can delete own pitchers" ON public.pitchers;

CREATE POLICY "Team members can view pitchers"
ON public.pitchers FOR SELECT
USING (
  team_id IS NULL OR 
  public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "Team members can create pitchers"
ON public.pitchers FOR INSERT
WITH CHECK (
  team_id IS NOT NULL AND 
  public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "Team members can update pitchers"
ON public.pitchers FOR UPDATE
USING (
  team_id IS NULL OR 
  public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "Team owners can delete pitchers"
ON public.pitchers FOR DELETE
USING (
  team_id IS NULL OR 
  public.is_team_owner(auth.uid(), team_id)
);

-- Update outings RLS to include team access
DROP POLICY IF EXISTS "Public can view outings" ON public.outings;
DROP POLICY IF EXISTS "Users can create own outings" ON public.outings;
DROP POLICY IF EXISTS "Users can update outings" ON public.outings;
DROP POLICY IF EXISTS "Users can delete outings" ON public.outings;

CREATE POLICY "Team members can view outings"
ON public.outings FOR SELECT
USING (
  team_id IS NULL OR 
  public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "Team members can create outings"
ON public.outings FOR INSERT
WITH CHECK (
  (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id)) OR
  (team_id IS NULL AND auth.uid() = user_id)
);

CREATE POLICY "Team members can update outings"
ON public.outings FOR UPDATE
USING (
  team_id IS NULL OR 
  public.is_team_member(auth.uid(), team_id) OR
  user_id IS NULL
);

CREATE POLICY "Team owners can delete outings"
ON public.outings FOR DELETE
USING (
  team_id IS NULL OR 
  public.is_team_owner(auth.uid(), team_id) OR
  auth.uid() = user_id OR
  user_id IS NULL
);

-- Update pitch_locations RLS to include team access
DROP POLICY IF EXISTS "Public can view pitch_locations" ON public.pitch_locations;
DROP POLICY IF EXISTS "Users can create own pitch_locations" ON public.pitch_locations;
DROP POLICY IF EXISTS "Users can update own pitch_locations" ON public.pitch_locations;
DROP POLICY IF EXISTS "Users can delete own pitch_locations" ON public.pitch_locations;

CREATE POLICY "Team members can view pitch_locations"
ON public.pitch_locations FOR SELECT
USING (
  team_id IS NULL OR 
  public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "Team members can create pitch_locations"
ON public.pitch_locations FOR INSERT
WITH CHECK (
  (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id)) OR
  (team_id IS NULL AND auth.uid() = user_id)
);

CREATE POLICY "Team members can update pitch_locations"
ON public.pitch_locations FOR UPDATE
USING (
  team_id IS NULL OR 
  public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "Team owners can delete pitch_locations"
ON public.pitch_locations FOR DELETE
USING (
  team_id IS NULL OR 
  public.is_team_owner(auth.uid(), team_id)
);

-- Add trigger for updated_at on teams
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();