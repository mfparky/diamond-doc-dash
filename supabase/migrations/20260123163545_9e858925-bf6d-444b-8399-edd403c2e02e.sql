-- Create table for pitch location data
CREATE TABLE public.pitch_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  outing_id UUID NOT NULL REFERENCES public.outings(id) ON DELETE CASCADE,
  pitcher_id TEXT NOT NULL,
  pitch_number INTEGER NOT NULL,
  pitch_type INTEGER NOT NULL CHECK (pitch_type >= 1 AND pitch_type <= 5),
  x_location DECIMAL(5,2) NOT NULL,
  y_location DECIMAL(5,2) NOT NULL,
  is_strike BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add pitch type configuration to pitchers table
ALTER TABLE public.pitchers 
ADD COLUMN pitch_types JSONB DEFAULT '{"1": "FB", "2": "CB", "3": "CH", "4": "SL", "5": "CT"}'::jsonb;

-- Enable RLS on pitch_locations
ALTER TABLE public.pitch_locations ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for public access
CREATE POLICY "Allow public read access to pitch_locations" 
ON public.pitch_locations FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to pitch_locations" 
ON public.pitch_locations FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to pitch_locations" 
ON public.pitch_locations FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access to pitch_locations" 
ON public.pitch_locations FOR DELETE USING (true);

-- Create index for efficient querying
CREATE INDEX idx_pitch_locations_outing_id ON public.pitch_locations(outing_id);
CREATE INDEX idx_pitch_locations_pitcher_id ON public.pitch_locations(pitcher_id);