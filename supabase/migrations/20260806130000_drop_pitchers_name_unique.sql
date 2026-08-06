-- Phase 6 (multi-team hardening): pitchers.name has carried a table-wide
-- UNIQUE constraint since the very first migration (20260121154904) and it
-- was never dropped by anything later. In a multi-team product this means
-- two DIFFERENT teams cannot both roster a pitcher with the same name —
-- any second team trying to add e.g. "Jack Smith" would get a constraint
-- violation, since uniqueness was never scoped to (team_id, name). This
-- directly blocks the "same-named pitcher on two teams" scenario the whole
-- multi-team hardening effort assumes must work.
--
-- Drops whatever unique constraint currently covers exactly (name) on
-- public.pitchers, found dynamically via pg_constraint rather than a
-- hardcoded name, so this is safe to run whether the constraint still has
-- its default auto-generated name (pitchers_name_key) or was renamed at
-- some point outside tracked migrations.
--
-- Not replaced with a scoped UNIQUE(team_id, name) constraint — team_id is
-- nullable (legacy solo-coach rows) and duplicate names within the SAME
-- team are a product/UX concern for a future pass, not a correctness
-- requirement this migration needs to take a position on.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'pitchers'
    AND con.contype = 'u'
    AND con.conkey = (
      SELECT array_agg(attnum ORDER BY attnum)
      FROM pg_attribute
      WHERE attrelid = rel.oid AND attname = 'name'
    )
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pitchers DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
