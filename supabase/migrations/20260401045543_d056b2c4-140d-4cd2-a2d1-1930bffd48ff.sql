CREATE TABLE IF NOT EXISTS public.dashboard_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  achievement_from DATE,
  achievement_to DATE,
  leaderboard_from DATE,
  leaderboard_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their dashboard settings"
ON public.dashboard_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Owners can create their dashboard settings"
ON public.dashboard_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their dashboard settings"
ON public.dashboard_settings
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Public can view dashboard settings by user"
ON public.dashboard_settings
FOR SELECT
TO anon
USING (true);

CREATE TRIGGER update_dashboard_settings_updated_at
BEFORE UPDATE ON public.dashboard_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();