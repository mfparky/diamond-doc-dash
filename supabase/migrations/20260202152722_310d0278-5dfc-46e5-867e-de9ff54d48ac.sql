-- Add coach_notes column to outings table
ALTER TABLE public.outings ADD COLUMN coach_notes TEXT DEFAULT NULL;