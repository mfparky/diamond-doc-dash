-- Coach-controlled publish flag. Report cards are coach-only by default;
-- a coach can flip a card to published so it shows up on that one player's
-- public dashboard (/player/:playerId). Publishing never widens the read
-- path beyond that single pitcher_id row — every consumer (PlayerDashboard)
-- fetches with .eq('pitcher_id', playerId) from the URL, the same scoping
-- already used for that page's outings, badges, and workout data.
ALTER TABLE public.report_cards
  ADD COLUMN published BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;

CREATE POLICY "Public can read published report cards"
  ON public.report_cards
  FOR SELECT
  USING (published = true);
