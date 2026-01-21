-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create pitchers table for roster management
CREATE TABLE public.pitchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  max_weekly_pitches INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pitchers ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required for now)
CREATE POLICY "Anyone can view pitchers" 
ON public.pitchers 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can add pitchers" 
ON public.pitchers 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update pitchers" 
ON public.pitchers 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete pitchers" 
ON public.pitchers 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pitchers_updated_at
BEFORE UPDATE ON public.pitchers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with existing roster (alphabetically sorted)
INSERT INTO public.pitchers (name) VALUES
  ('Ari Van Pelt'),
  ('Colin Perry'),
  ('Eli Aitchison'),
  ('Jackson Dabusinskas'),
  ('Luca DiMauro'),
  ('Mason Gomes'),
  ('Michael Castaldi'),
  ('Nico Aitchison'),
  ('Nicolas Srenk'),
  ('Owen Parkinson'),
  ('Sebastien Poulin'),
  ('Will Smith'),
  ('Will Sorochan');