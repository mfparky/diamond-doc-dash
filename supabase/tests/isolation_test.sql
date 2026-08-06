-- Phase 6 (multi-team hardening): live-database isolation test.
--
-- HOW TO RUN
-- This is plain SQL, not a migration — it lives outside supabase/migrations/
-- so the migration runner never picks it up. Run it manually via psql
-- against a Postgres instance that already has every migration in
-- supabase/migrations/ applied (a local `supabase start` instance, or the
-- same Cloud Shell + psql path already used to apply migrations to the real
-- project):
--   psql "$DB_URL" -f supabase/tests/isolation_test.sql
-- A clean run ends with "ISOLATION TEST: ALL CHECKS PASSED" and rolls back
-- (see SAFETY below). Any violated assertion raises an exception and aborts
-- the whole transaction immediately — read the RAISE message to see which
-- check failed.
--
-- SAFETY
-- Everything below runs inside one transaction that is always ROLLED BACK
-- at the end, so it is safe to run even against a database with real data —
-- the seeded fake teams/pitchers/rows never persist either way. Every
-- fabricated id used here starts with 'a0000000-' or 'b0000000-' so it can
-- never collide with a real row's randomly-generated UUID.
--
-- REQUIRED VARIABLES
-- public.teams.owner_id has a foreign key to auth.users, so the two fake
-- teams' owners must be real, already-existing auth.users ids (any two
-- distinct users work — nothing is written to their real account, the
-- transaction always rolls back). Pass them in with -v:
--   psql "$DB_URL" -v owner_a_id='<real-uuid>' -v owner_b_id='<real-uuid>' -f supabase/tests/isolation_test.sql
--
-- WHAT IT PROVES
-- Seeds two teams (A, B), each with a pitcher named "Same Name" (proving
-- name collisions across teams don't cause crossover — see
-- 20260806130000_drop_pitchers_name_unique.sql, which is what makes this
-- scenario possible to seed at all), one outing, one pitch location, one
-- workout assignment, and one workout completion per team. Then, switching
-- role to simulate team A's owner and separately to an anonymous caller,
-- asserts:
--   1. Direct SELECT on every hardened table returns ONLY team A's rows,
--      never team B's.
--   2. Every relevant get_public_* RPC, called with team A's / pitcher A's
--      id, returns ONLY team A's data — never leaks team B's despite the
--      identical pitcher name.
--   3. mark_workout_complete / unmark_workout_complete refuse to touch team
--      B's assignment/completion when called with team A's pitcher id.

\set ON_ERROR_STOP on
\if :{?owner_a_id}
\else
  \warn 'owner_a_id not set — pass -v owner_a_id=<real-user-uuid>'
  \quit
\endif
\if :{?owner_b_id}
\else
  \warn 'owner_b_id not set — pass -v owner_b_id=<real-user-uuid>'
  \quit
\endif

BEGIN;

-- psql does not expand :'var' substitutions inside dollar-quoted ($$) bodies
-- (it treats that content as an opaque literal, since function/procedure
-- bodies often contain literal colons of their own). Route the two real
-- user ids through a session setting instead, readable via current_setting()
-- from inside the DO block below.
SELECT set_config('isolation_test.owner_a_id', :'owner_a_id', true);
SELECT set_config('isolation_test.owner_b_id', :'owner_b_id', true);

-- ── Seed two teams with a same-named pitcher on each ────────────────────
DO $seed$
DECLARE
  owner_a uuid := current_setting('isolation_test.owner_a_id')::uuid;
  owner_b uuid := current_setting('isolation_test.owner_b_id')::uuid;
  team_a uuid := 'a0000000-0000-0000-0000-000000000002';
  team_b uuid := 'b0000000-0000-0000-0000-000000000002';
  pitcher_a uuid := 'a0000000-0000-0000-0000-000000000003';
  pitcher_b uuid := 'b0000000-0000-0000-0000-000000000003';
  outing_a uuid := 'a0000000-0000-0000-0000-000000000004';
  outing_b uuid := 'b0000000-0000-0000-0000-000000000004';
  assignment_a uuid := 'a0000000-0000-0000-0000-000000000005';
  assignment_b uuid := 'b0000000-0000-0000-0000-000000000005';
  completion_a uuid := 'a0000000-0000-0000-0000-000000000006';
  completion_b uuid := 'b0000000-0000-0000-0000-000000000006';
BEGIN
  INSERT INTO public.teams (id, name, owner_id, join_code) VALUES
    (team_a, 'Isolation Test Team A', owner_a, 'itsta1'),
    (team_b, 'Isolation Test Team B', owner_b, 'itstb1');

  INSERT INTO public.team_members (team_id, user_id, role) VALUES
    (team_a, owner_a, 'owner'),
    (team_b, owner_b, 'owner');

  INSERT INTO public.pitchers (id, name, team_id, max_weekly_pitches) VALUES
    (pitcher_a, 'Same Name', team_a, 120),
    (pitcher_b, 'Same Name', team_b, 120);

  INSERT INTO public.outings (id, pitcher_id, pitcher_uuid, pitcher_name, team_id, date, event_type, pitch_count) VALUES
    (outing_a, pitcher_a::text, pitcher_a, 'Same Name', team_a, current_date, 'Bullpen', 10),
    (outing_b, pitcher_b::text, pitcher_b, 'Same Name', team_b, current_date, 'Bullpen', 10);

  INSERT INTO public.pitch_locations (outing_id, pitcher_id, pitch_number, pitch_type, x_location, y_location) VALUES
    (outing_a, pitcher_a::text, 1, 1, 0, 0),
    (outing_b, pitcher_b::text, 1, 1, 0, 0);

  INSERT INTO public.workout_assignments (id, pitcher_id, team_id, title) VALUES
    (assignment_a, pitcher_a, team_a, 'Test workout A'),
    (assignment_b, pitcher_b, team_b, 'Test workout B');

  INSERT INTO public.workout_completions (id, assignment_id, pitcher_id, week_start, day_of_week) VALUES
    (completion_a, assignment_a, pitcher_a, date_trunc('week', current_date)::date, 0),
    (completion_b, assignment_b, pitcher_b, date_trunc('week', current_date)::date, 0);

  RAISE NOTICE 'DEBUG: pitcher_a=% pitcher_b=% completion_a=% completion_b=%', pitcher_a, pitcher_b, completion_a, completion_b;
END $seed$;

-- ── Part 1: direct table access as team A's authenticated owner ─────────
SET LOCAL role = 'authenticated';
SELECT set_config('request.jwt.claims', json_build_object('sub', :'owner_a_id')::text, true);

DO $check$
BEGIN
  IF (SELECT count(*) FROM public.pitchers WHERE id = 'b0000000-0000-0000-0000-000000000003') > 0 THEN
    RAISE EXCEPTION 'FAIL: team A owner can see team B pitcher via direct SELECT on pitchers';
  END IF;
  IF (SELECT count(*) FROM public.pitchers WHERE team_id = 'a0000000-0000-0000-0000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'FAIL: team A owner cannot see their own pitcher via direct SELECT on pitchers';
  END IF;

  IF (SELECT count(*) FROM public.outings WHERE id = 'b0000000-0000-0000-0000-000000000004') > 0 THEN
    RAISE EXCEPTION 'FAIL: team A owner can see team B outing via direct SELECT on outings';
  END IF;

  IF (SELECT count(*) FROM public.pitch_locations WHERE pitcher_id = 'b0000000-0000-0000-0000-000000000003') > 0 THEN
    RAISE EXCEPTION 'FAIL: team A owner can see team B pitch_locations via direct SELECT';
  END IF;

  IF (SELECT count(*) FROM public.workout_assignments WHERE id = 'b0000000-0000-0000-0000-000000000005') > 0 THEN
    RAISE EXCEPTION 'FAIL: team A owner can see team B workout_assignments via direct SELECT';
  END IF;

  IF (SELECT count(*) FROM public.workout_completions WHERE id = 'b0000000-0000-0000-0000-000000000006') > 0 THEN
    RAISE EXCEPTION 'FAIL: team A owner can see team B workout_completions via direct SELECT (this table has NO direct-access policies at all post-Phase-5 — a non-zero count here means a policy regression)';
  END IF;

  RAISE NOTICE 'Part 1 (authenticated direct table access) passed';
END $check$;

-- ── Part 2: anonymous direct table access ────────────────────────────────
RESET role;
SELECT set_config('request.jwt.claims', '', true);
SET LOCAL role = 'anon';

DO $check$
BEGIN
  IF (SELECT count(*) FROM public.pitchers WHERE id IN (
    'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003'
  )) > 0 THEN
    RAISE EXCEPTION 'FAIL: anon can read pitchers directly (either team) — the legacy USING(true) hole is back';
  END IF;

  IF (SELECT count(*) FROM public.outings WHERE id IN (
    'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004'
  )) > 0 THEN
    RAISE EXCEPTION 'FAIL: anon can read outings directly — the legacy USING(true) hole is back';
  END IF;

  IF (SELECT count(*) FROM public.pitch_locations WHERE pitcher_id IN (
    'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003'
  )) > 0 THEN
    RAISE EXCEPTION 'FAIL: anon can read pitch_locations directly — the legacy USING(true) hole is back';
  END IF;

  IF (SELECT count(*) FROM public.workout_assignments WHERE id IN (
    'a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005'
  )) > 0 THEN
    RAISE EXCEPTION 'FAIL: anon can read workout_assignments directly — Phase 5''s public policy drop regressed';
  END IF;

  IF (SELECT count(*) FROM public.workout_completions WHERE id IN (
    'a0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006'
  )) > 0 THEN
    RAISE EXCEPTION 'FAIL: anon can read workout_completions directly — Phase 5''s policy drop regressed';
  END IF;

  RAISE NOTICE 'Part 2 (anonymous direct table access) passed';
END $check$;

-- ── Part 3: public RPCs never leak team B despite the identical pitcher name ──
DO $check$
DECLARE
  r record;
  cnt int;
BEGIN
  -- get_public_pitcher: id-scoped, must return exactly pitcher A, never B.
  SELECT count(*) INTO cnt FROM public.get_public_pitcher('a0000000-0000-0000-0000-000000000003');
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'FAIL: get_public_pitcher(pitcher A) returned % rows, expected 1', cnt;
  END IF;

  -- get_public_team_pitchers(team A) must contain only pitcher A's row.
  SELECT count(*) INTO cnt FROM public.get_public_team_pitchers('a0000000-0000-0000-0000-000000000002');
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'FAIL: get_public_team_pitchers(team A) returned % rows, expected 1', cnt;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.get_public_team_pitchers('a0000000-0000-0000-0000-000000000002') p
    WHERE p.id = 'b0000000-0000-0000-0000-000000000003'
  ) THEN
    RAISE EXCEPTION 'FAIL: get_public_team_pitchers(team A) leaked team B''s same-named pitcher';
  END IF;

  -- get_public_pitcher_outings(pitcher A) must never include team B's outing,
  -- even though both outings share pitcher_name = 'Same Name'.
  IF EXISTS (
    SELECT 1 FROM public.get_public_pitcher_outings('a0000000-0000-0000-0000-000000000003') o
    WHERE o.id = 'b0000000-0000-0000-0000-000000000004'
  ) THEN
    RAISE EXCEPTION 'FAIL: get_public_pitcher_outings(pitcher A) leaked team B''s outing via name collision';
  END IF;

  -- get_public_team_outings(team A) must never include team B's outing.
  IF EXISTS (
    SELECT 1 FROM public.get_public_team_outings('a0000000-0000-0000-0000-000000000002') o
    WHERE o.id = 'b0000000-0000-0000-0000-000000000004'
  ) THEN
    RAISE EXCEPTION 'FAIL: get_public_team_outings(team A) leaked team B''s outing';
  END IF;

  -- get_public_pitcher_pitch_locations(pitcher A) must never include team B's row.
  SELECT count(*) INTO cnt FROM public.get_public_pitcher_pitch_locations('a0000000-0000-0000-0000-000000000003');
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'FAIL: get_public_pitcher_pitch_locations(pitcher A) returned % rows, expected 1', cnt;
  END IF;

  -- get_public_team_workout_assignments(team A) must never include team B's assignment.
  IF EXISTS (
    SELECT 1 FROM public.get_public_team_workout_assignments('a0000000-0000-0000-0000-000000000002') wa
    WHERE wa.id = 'b0000000-0000-0000-0000-000000000005'
  ) THEN
    RAISE EXCEPTION 'FAIL: get_public_team_workout_assignments(team A) leaked team B''s assignment';
  END IF;

  -- get_public_pitcher_workout_completions(pitcher A) must never include team B's completion.
  IF EXISTS (
    SELECT 1 FROM public.get_public_pitcher_workout_completions('a0000000-0000-0000-0000-000000000003') wc
    WHERE wc.id = 'b0000000-0000-0000-0000-000000000006'
  ) THEN
    RAISE EXCEPTION 'FAIL: get_public_pitcher_workout_completions(pitcher A) leaked team B''s completion';
  END IF;

  RAISE NOTICE 'Part 3 (public RPC scoping, same-name collision) passed';
END $check$;

-- ── Part 4: workout-completion write RPCs refuse cross-team requests ────
DO $check$
DECLARE
  bogus_result record;
  threw boolean := false;
BEGIN
  RAISE NOTICE 'DEBUG: workout_completions row count at start of Part 4 = %',
    (SELECT count(*) FROM public.workout_completions);

  -- mark_workout_complete with team A's pitcher but team B's assignment must be rejected.
  BEGIN
    SELECT * INTO bogus_result FROM public.mark_workout_complete(
      'b0000000-0000-0000-0000-000000000005'::uuid, -- team B's assignment
      'a0000000-0000-0000-0000-000000000003'::uuid, -- team A's pitcher
      date_trunc('week', current_date)::date, 1, 'cross-team attempt'
    );
    threw := false;
  EXCEPTION WHEN OTHERS THEN
    threw := true;
    RAISE NOTICE 'DEBUG: mark_workout_complete raised: %', SQLERRM;
  END;
  RAISE NOTICE 'DEBUG: workout_completions row count after mark attempt = %',
    (SELECT count(*) FROM public.workout_completions);
  IF NOT threw THEN
    RAISE EXCEPTION 'FAIL: mark_workout_complete accepted team A pitcher against team B assignment';
  END IF;

  -- unmark_workout_complete with team A's pitcher but team B's completion id must delete nothing.
  RAISE NOTICE 'DEBUG: completion_b.pitcher_id before unmark = %',
    (SELECT pitcher_id FROM public.workout_completions WHERE id = 'b0000000-0000-0000-0000-000000000006');
  PERFORM public.unmark_workout_complete(
    'b0000000-0000-0000-0000-000000000006'::uuid, -- team B's completion
    'a0000000-0000-0000-0000-000000000003'::uuid  -- team A's pitcher
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.workout_completions WHERE id = 'b0000000-0000-0000-0000-000000000006'
  ) THEN
    RAISE EXCEPTION 'FAIL: unmark_workout_complete deleted team B''s completion when called with team A''s pitcher id';
  END IF;

  -- update_workout_completion_notes with team A's pitcher but team B's completion id must change nothing.
  PERFORM public.update_workout_completion_notes(
    'b0000000-0000-0000-0000-000000000006'::uuid,
    'a0000000-0000-0000-0000-000000000003'::uuid,
    'cross-team overwrite attempt'
  );
  IF EXISTS (
    SELECT 1 FROM public.workout_completions
    WHERE id = 'b0000000-0000-0000-0000-000000000006' AND notes = 'cross-team overwrite attempt'
  ) THEN
    RAISE EXCEPTION 'FAIL: update_workout_completion_notes modified team B''s completion when called with team A''s pitcher id';
  END IF;

  RAISE NOTICE 'Part 4 (workout completion write RPCs reject cross-team calls) passed';
END $check$;

DO $$ BEGIN RAISE NOTICE 'ISOLATION TEST: ALL CHECKS PASSED'; END $$;

ROLLBACK;
