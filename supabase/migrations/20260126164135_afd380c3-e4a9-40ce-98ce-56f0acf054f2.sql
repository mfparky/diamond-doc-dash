-- Drop all existing permissive public policies for outings
DROP POLICY IF EXISTS "Allow public delete access to outings" ON public.outings;
DROP POLICY IF EXISTS "Allow public insert access to outings" ON public.outings;
DROP POLICY IF EXISTS "Allow public read access to outings" ON public.outings;
DROP POLICY IF EXISTS "Allow public update access to outings" ON public.outings;

-- Drop all existing permissive public policies for pitchers
DROP POLICY IF EXISTS "Allow public delete access to pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Allow public insert access to pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Allow public read access to pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Allow public update access to pitchers" ON public.pitchers;

-- Drop all existing permissive public policies for pitch_locations
DROP POLICY IF EXISTS "Allow public delete access to pitch_locations" ON public.pitch_locations;
DROP POLICY IF EXISTS "Allow public insert access to pitch_locations" ON public.pitch_locations;
DROP POLICY IF EXISTS "Allow public read access to pitch_locations" ON public.pitch_locations;
DROP POLICY IF EXISTS "Allow public update access to pitch_locations" ON public.pitch_locations;

-- Create public SELECT policies (for player dashboard / parent viewing)
CREATE POLICY "Public can view outings"
  ON public.outings FOR SELECT
  USING (true);

CREATE POLICY "Public can view pitchers"
  ON public.pitchers FOR SELECT
  USING (true);

CREATE POLICY "Public can view pitch_locations"
  ON public.pitch_locations FOR SELECT
  USING (true);

-- Create authenticated-only INSERT policies
CREATE POLICY "Authenticated users can create outings"
  ON public.outings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create pitchers"
  ON public.pitchers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create pitch_locations"
  ON public.pitch_locations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create authenticated-only UPDATE policies
CREATE POLICY "Authenticated users can update outings"
  ON public.outings FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update pitchers"
  ON public.pitchers FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update pitch_locations"
  ON public.pitch_locations FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Create authenticated-only DELETE policies
CREATE POLICY "Authenticated users can delete outings"
  ON public.outings FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete pitchers"
  ON public.pitchers FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete pitch_locations"
  ON public.pitch_locations FOR DELETE
  USING (auth.role() = 'authenticated');