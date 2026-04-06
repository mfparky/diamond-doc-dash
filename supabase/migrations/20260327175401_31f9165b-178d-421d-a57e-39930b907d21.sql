CREATE TABLE public.user_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_at timestamp with time zone,
  UNIQUE(user_id)
);

ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;

-- Anyone can read their own approval status
CREATE POLICY "Users can view own approval"
  ON public.user_approvals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow inserts from authenticated users (for self-registration)
CREATE POLICY "Users can insert own approval"
  ON public.user_approvals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Public select so the sign-in flow can check before full auth
CREATE POLICY "Public can check approval by user_id"
  ON public.user_approvals FOR SELECT
  TO anon
  USING (true);