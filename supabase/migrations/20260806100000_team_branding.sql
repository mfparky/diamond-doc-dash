-- Phase 4 (multi-team hardening): per-team branding correctness.
-- Adds a logo per team and extends the public team-info RPC to expose it
-- (alongside design_system, already returned there) so both the
-- authenticated app and public dashboards can apply the right team's
-- branding instead of DesignSystemContext's previous unscoped/arbitrary
-- team fetch.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Storage bucket for team logos, mirroring the existing outing-videos
-- bucket's public-read / owner-scoped-write pattern.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-logos',
  'team-logos',
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view team logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-logos');

-- Uploads are keyed by team id as the first path segment
-- (team-logos/<team_id>/logo.<ext>) — only that team's owner may write
-- there.
CREATE POLICY "Team owners can upload their team logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'team-logos'
  AND public.is_team_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Team owners can update their team logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'team-logos'
  AND public.is_team_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Team owners can delete their team logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'team-logos'
  AND public.is_team_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- CREATE OR REPLACE can't change a function's return-row shape (it's adding
-- logo_url to the existing 7-column return type here), so the prior
-- signature must be dropped explicitly first.
DROP FUNCTION IF EXISTS public.get_public_team_info(uuid);

CREATE OR REPLACE FUNCTION public.get_public_team_info(p_team_id uuid)
RETURNS TABLE (
  id uuid, name text, design_system text, logo_url text,
  leaderboard_from date, leaderboard_to date,
  achievement_from date, achievement_to date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.name, t.design_system, t.logo_url, t.leaderboard_from, t.leaderboard_to,
         t.achievement_from, t.achievement_to
  FROM public.teams t
  WHERE t.id = p_team_id;
$$;
