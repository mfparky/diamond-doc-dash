-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update own outings" ON public.outings;

-- Create new update policy that allows:
-- 1. Users to update their own outings (where user_id matches)
-- 2. Any authenticated user to update legacy outings (where user_id is null)
CREATE POLICY "Users can update outings" 
ON public.outings 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  OR user_id IS NULL
);

-- Also update the delete policy for consistency
DROP POLICY IF EXISTS "Users can delete own outings" ON public.outings;

CREATE POLICY "Users can delete outings" 
ON public.outings 
FOR DELETE 
USING (
  auth.uid() = user_id 
  OR user_id IS NULL
);