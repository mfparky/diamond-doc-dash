-- Add public SELECT policies for player dashboard access
-- These allow anonymous users to view pitcher data by player ID

-- Allow public to view specific pitchers (for parent dashboard)
CREATE POLICY "Public can view pitchers by id"
ON public.pitchers FOR SELECT
TO anon, authenticated
USING (true);

-- Allow public to view outings for any pitcher (for parent dashboard)
CREATE POLICY "Public can view outings by pitcher"
ON public.outings FOR SELECT
TO anon, authenticated
USING (true);

-- Allow public to view pitch_locations (for parent dashboard)
CREATE POLICY "Public can view pitch_locations by pitcher"
ON public.pitch_locations FOR SELECT
TO anon, authenticated
USING (true);