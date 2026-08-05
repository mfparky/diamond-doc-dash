-- Phase 0 (multi-team hardening): document is_team_member() / is_team_owner(),
-- the two functions every team-scoped RLS policy already depends on. These
-- exist live but have no tracked CREATE FUNCTION anywhere in migration
-- history, so their real body/argument order cannot be verified from this
-- repo alone.
--
-- To avoid any risk of silently changing production behavior for functions
-- that are already working, this migration ONLY creates them when they are
-- completely absent (fresh database / local dev / CI). On production, where
-- they already exist, this is a full no-op — the live functions are never
-- touched. The bodies below are a best-effort reconstruction from how every
-- RLS policy in this codebase calls them (team membership / owner-role
-- lookup against team_members) and are intended for local dev parity only.
--
-- If you have access to the live Supabase project, prefer running
-- `pg_get_functiondef('public.is_team_member'::regproc)` and
-- `pg_get_functiondef('public.is_team_owner'::regproc)` and replacing the
-- bodies below with the verbatim output, then re-running this migration
-- locally to confirm no drift.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_team_member'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public.team_members
          WHERE user_id = _user_id AND team_id = _team_id
        );
      $body$;
    $fn$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_team_owner'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public.team_members
          WHERE user_id = _user_id AND team_id = _team_id AND role = 'owner'
        );
      $body$;
    $fn$;
  END IF;
END $$;
