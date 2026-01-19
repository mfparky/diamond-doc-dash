-- Create outings table to store pitcher outing data
CREATE TABLE public.outings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pitcher_id TEXT NOT NULL,
  pitcher_name TEXT NOT NULL,
  date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('game', 'practice', 'bullpen')),
  pitch_count INTEGER NOT NULL CHECK (pitch_count >= 0),
  strikes INTEGER CHECK (strikes >= 0),
  max_velocity INTEGER CHECK (max_velocity >= 0),
  notes TEXT,
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.outings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (team coaching tool)
CREATE POLICY "Anyone can view outings" 
ON public.outings 
FOR SELECT 
USING (true);

-- Allow public insert access (for logging outings without auth)
CREATE POLICY "Anyone can log outings" 
ON public.outings 
FOR INSERT 
WITH CHECK (true);

-- Allow public update access
CREATE POLICY "Anyone can update outings" 
ON public.outings 
FOR UPDATE 
USING (true);

-- Allow public delete access
CREATE POLICY "Anyone can delete outings" 
ON public.outings 
FOR DELETE 
USING (true);

-- Create index for faster queries by pitcher
CREATE INDEX idx_outings_pitcher_id ON public.outings(pitcher_id);

-- Create index for faster queries by date
CREATE INDEX idx_outings_date ON public.outings(date DESC);