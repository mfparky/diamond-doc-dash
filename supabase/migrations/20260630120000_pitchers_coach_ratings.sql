-- Subjective coach ratings that weigh into Player Value on the Rankings page.
-- Each rating is one of 'minus' / 'even' / 'plus', or null if the coach hasn't
-- rated the player yet. Null means "no rating" — the Intangibles bucket
-- re-normalizes weights, so unrated players aren't penalized.
ALTER TABLE public.pitchers
  ADD COLUMN IF NOT EXISTS effort_rating TEXT CHECK (effort_rating IS NULL OR effort_rating IN ('minus', 'even', 'plus')),
  ADD COLUMN IF NOT EXISTS coachability_rating TEXT CHECK (coachability_rating IS NULL OR coachability_rating IN ('minus', 'even', 'plus')),
  ADD COLUMN IF NOT EXISTS baseball_iq_rating TEXT CHECK (baseball_iq_rating IS NULL OR baseball_iq_rating IN ('minus', 'even', 'plus'));
