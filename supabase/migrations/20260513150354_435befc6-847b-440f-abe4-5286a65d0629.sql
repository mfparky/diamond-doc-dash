-- Games table
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID,
  user_id UUID,
  date DATE NOT NULL,
  opponent_name TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view games" ON public.games FOR SELECT
  USING (is_team_member(auth.uid(), team_id) OR (team_id IS NULL AND user_id = auth.uid()));
CREATE POLICY "Public can view games" ON public.games FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Team members can create games" ON public.games FOR INSERT
  WITH CHECK (((team_id IS NOT NULL) AND is_team_member(auth.uid(), team_id)) OR ((team_id IS NULL) AND (auth.uid() = user_id)));
CREATE POLICY "Team members can update games" ON public.games FOR UPDATE
  USING (is_team_member(auth.uid(), team_id) OR ((team_id IS NULL) AND (user_id = auth.uid())));
CREATE POLICY "Team owners can delete games" ON public.games FOR DELETE
  USING (is_team_owner(auth.uid(), team_id) OR ((team_id IS NULL) AND (user_id = auth.uid())));

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Game pitches table
CREATE TABLE public.game_pitches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL,
  pitcher_id UUID NOT NULL,
  pitcher_name TEXT NOT NULL,
  inning INTEGER NOT NULL DEFAULT 1,
  is_strike BOOLEAN NOT NULL,
  sequence INTEGER NOT NULL,
  team_id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_pitches_game ON public.game_pitches(game_id);
CREATE INDEX idx_game_pitches_pitcher ON public.game_pitches(pitcher_id);

ALTER TABLE public.game_pitches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view game_pitches" ON public.game_pitches FOR SELECT
  USING (is_team_member(auth.uid(), team_id) OR (team_id IS NULL AND user_id = auth.uid()));
CREATE POLICY "Public can view game_pitches" ON public.game_pitches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Team members can create game_pitches" ON public.game_pitches FOR INSERT
  WITH CHECK (((team_id IS NOT NULL) AND is_team_member(auth.uid(), team_id)) OR ((team_id IS NULL) AND (auth.uid() = user_id)));
CREATE POLICY "Team members can update game_pitches" ON public.game_pitches FOR UPDATE
  USING (is_team_member(auth.uid(), team_id) OR ((team_id IS NULL) AND (user_id = auth.uid())));
CREATE POLICY "Team owners can delete game_pitches" ON public.game_pitches FOR DELETE
  USING (is_team_owner(auth.uid(), team_id) OR ((team_id IS NULL) AND (user_id = auth.uid())));