-- Drop the restrictive policies
DROP POLICY IF EXISTS "Authenticated users can view outings" ON public.outings;
DROP POLICY IF EXISTS "Authenticated users can create outings" ON public.outings;
DROP POLICY IF EXISTS "Authenticated users can update outings" ON public.outings;
DROP POLICY IF EXISTS "Authenticated users can delete outings" ON public.outings;

DROP POLICY IF EXISTS "Authenticated users can view pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Authenticated users can create pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Authenticated users can update pitchers" ON public.pitchers;
DROP POLICY IF EXISTS "Authenticated users can delete pitchers" ON public.pitchers;

-- Create permissive policies for public access (until authentication is implemented)
CREATE POLICY "Allow public read access to outings"
ON public.outings FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access to outings"
ON public.outings FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access to outings"
ON public.outings FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete access to outings"
ON public.outings FOR DELETE
USING (true);

CREATE POLICY "Allow public read access to pitchers"
ON public.pitchers FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access to pitchers"
ON public.pitchers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access to pitchers"
ON public.pitchers FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete access to pitchers"
ON public.pitchers FOR DELETE
USING (true);