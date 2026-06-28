-- Allow signed-in team owners (and any authenticated user) to look up approvals,
-- so that the "Manage scorekeepers" dialog can resolve a user_id from an email.
-- The same data is already publicly readable by the anon role; this just extends
-- the existing visibility to the authenticated role.
DROP POLICY IF EXISTS "Public can check approval by user_id" ON public.user_approvals;
CREATE POLICY "Anyone can check approval"
  ON public.user_approvals
  FOR SELECT
  TO anon, authenticated
  USING (true);