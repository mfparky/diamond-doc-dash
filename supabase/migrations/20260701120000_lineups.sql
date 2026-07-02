-- One coach-owned lineup per date. Batting order is stored as a JSONB
-- array of pitcher UUIDs (references public.pitchers.id) so we can add
-- pitching_plan / defensive_alignment columns later without another table.
CREATE TABLE public.lineups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  /** Ordered array of pitcher ids — lineup card, 1-indexed conceptually. */
  batting_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  /** Free-form coach notes. */
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_lineups_user_date
  ON public.lineups (user_id, date DESC);

ALTER TABLE public.lineups ENABLE ROW LEVEL SECURITY;

-- Coaches manage their own lineups end-to-end. No public read path in v1;
-- parents don't need to see the lineup card.
CREATE POLICY "Coaches manage their own lineups"
  ON public.lineups
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Keep updated_at fresh so the UI can show "last edited".
CREATE TRIGGER update_lineups_updated_at
BEFORE UPDATE ON public.lineups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
