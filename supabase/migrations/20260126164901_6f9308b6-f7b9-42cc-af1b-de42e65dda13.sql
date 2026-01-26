-- Add user_id column to pitchers table
ALTER TABLE public.pitchers 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to outings table
ALTER TABLE public.outings 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to pitch_locations table
ALTER TABLE public.pitch_locations 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing RLS policies for pitchers
DROP POLICY IF EXISTS "Public can view pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Authenticated users can create pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Authenticated users can update pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Authenticated users can delete pitchers" ON public.pitchers;

-- Drop existing RLS policies for outings
DROP POLICY IF EXISTS "Public can view outings" ON public.outings;
DROP POLICY IF EXISTS "Authenticated users can create outings" ON public.outings;
DROP POLICY IF EXISTS "Authenticated users can update outings" ON public.outings;
DROP POLICY IF EXISTS "Authenticated users can delete outings" ON public.outings;

-- Drop existing RLS policies for pitch_locations
DROP POLICY IF EXISTS "Public can view pitch_locations" ON public.pitch_locations;
DROP POLICY IF EXISTS "Authenticated users can create pitch_locations" ON public.pitch_locations;
DROP POLICY IF EXISTS "Authenticated users can update pitch_locations" ON public.pitch_locations;
DROP POLICY IF EXISTS "Authenticated users can delete pitch_locations" ON public.pitch_locations;

-- Create new RLS policies for pitchers with user isolation
CREATE POLICY "Public can view pitchers"
  ON public.pitchers FOR SELECT
  USING (true);

CREATE POLICY "Users can create own pitchers"
  ON public.pitchers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pitchers"
  ON public.pitchers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pitchers"
  ON public.pitchers FOR DELETE
  USING (auth.uid() = user_id);

-- Create new RLS policies for outings with user isolation
CREATE POLICY "Public can view outings"
  ON public.outings FOR SELECT
  USING (true);

CREATE POLICY "Users can create own outings"
  ON public.outings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outings"
  ON public.outings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own outings"
  ON public.outings FOR DELETE
  USING (auth.uid() = user_id);

-- Create new RLS policies for pitch_locations with user isolation
CREATE POLICY "Public can view pitch_locations"
  ON public.pitch_locations FOR SELECT
  USING (true);

CREATE POLICY "Users can create own pitch_locations"
  ON public.pitch_locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pitch_locations"
  ON public.pitch_locations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pitch_locations"
  ON public.pitch_locations FOR DELETE
  USING (auth.uid() = user_id);

-- Add length constraints to text fields
ALTER TABLE public.outings
  ADD CONSTRAINT outings_notes_length CHECK (length(notes) <= 2000),
  ADD CONSTRAINT outings_focus_length CHECK (length(focus) <= 200),
  ADD CONSTRAINT outings_video_url_length CHECK (length(video_url) <= 500);

ALTER TABLE public.pitchers
  ADD CONSTRAINT pitchers_name_length CHECK (length(name) <= 100);