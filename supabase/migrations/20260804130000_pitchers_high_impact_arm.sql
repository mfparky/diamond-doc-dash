-- Coach override for the Rankings page: a barely-pitched kid's ERA/WHIP
-- sample normally gets shrunk toward neutral (and its weight reduced) by the
-- pitching-participation floor, since a couple innings isn't a trustworthy
-- read. When a coach knows a specific arm is high-impact despite low IP
-- (e.g. a closer who only sees high-leverage one-inning spots), this flag
-- lets them bypass the floor for that one player so the pitching numbers
-- count at full trust and full weight.
ALTER TABLE public.pitchers
  ADD COLUMN IF NOT EXISTS high_impact_arm BOOLEAN NOT NULL DEFAULT false;
