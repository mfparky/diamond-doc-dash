-- Coach-authored mid-season report cards. One row per coach + player + period.
-- The narrative_* columns hold the coach's *edited* text; the model draft
-- flows through the UI and is discarded unless the coach saves it, so we
-- don't need a separate 'raw_llm_output' column.
CREATE TABLE public.report_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pitcher_id UUID NOT NULL REFERENCES public.pitchers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  /** Coach's qualitative input — feeds the LLM prompt. */
  coach_context TEXT,
  /** Model-drafted, coach-edited narrative sections. */
  narrative_summary TEXT,
  narrative_strengths TEXT,
  narrative_areas TEXT,
  /** Which stat snapshot fueled the model draft (metadata only). */
  snapshot_id UUID REFERENCES public.pitcher_stat_snapshots(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, pitcher_id, period_start)
);

CREATE INDEX idx_report_cards_user_pitcher
  ON public.report_cards (user_id, pitcher_id, period_start DESC);

ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;

-- Coach-only. No public read path in v1; sharing is via a coach-controlled
-- print / share flow rather than a shareable URL.
CREATE POLICY "Coaches manage their own report cards"
  ON public.report_cards
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_report_cards_updated_at
BEFORE UPDATE ON public.report_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
