-- Add focus column to outings table for mechanical focus tracking
ALTER TABLE public.outings 
ADD COLUMN focus TEXT;