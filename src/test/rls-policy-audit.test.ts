import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// Regression guard for the exact class of bug that caused a real cross-team
// data leak in this app: a migration adds/leaves behind a fully permissive
// `USING (true)` (or `WITH CHECK (true)`) RLS policy on a table that must be
// team/user-scoped, and a *later* migration drops some, but not all, of the
// permissive policies covering that table (Postgres ORs multiple permissive
// policies together, so a single leftover `true` policy defeats every other
// policy on the table). This replays every migration's CREATE POLICY / DROP
// POLICY statements in order and asserts that, in the final state, none of
// the tables that must never leak across teams still has a live
// unconditionally-permissive policy.
//
// This is static analysis over the migration files, not a live-database
// test — it can't see drift applied directly against production outside of
// tracked migrations. See supabase/tests/isolation_test.sql for the
// live-database counterpart (must be run manually via psql against a real
// Postgres instance with these migrations applied).

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");

// Tables where a same-effect "everyone can read/write every row" policy is
// exactly the crossover bug this whole hardening effort exists to prevent.
const MUST_NEVER_BE_UNCONDITIONALLY_PERMISSIVE = new Set([
  "pitchers",
  "outings",
  "pitch_locations",
  "games",
  "game_pitches",
  "teams",
  "workout_assignments",
  "workout_completions",
  "user_approvals",
]);

interface PolicyEvent {
  fileOrder: number;
  kind: "CREATE" | "DROP";
  table: string;
  name: string;
  statementText: string; // only meaningful for CREATE
}

function loadMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql")) // excludes ROLLBACK_*.sql.txt
    .sort(); // filenames are zero-padded timestamps, so lexical sort == chronological
}

function extractEvents(fileOrder: number, text: string): PolicyEvent[] {
  const events: PolicyEvent[] = [];

  const createRe = /CREATE POLICY\s+"([^"]+)"\s*\n?\s*ON\s+public\.(\w+)/gi;
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(text))) {
    const name = m[1];
    const table = m[2];
    const semiIdx = text.indexOf(";", m.index);
    const statementText = text.slice(m.index, semiIdx === -1 ? undefined : semiIdx + 1);
    events.push({ fileOrder, kind: "CREATE", table, name, statementText });
  }

  const dropRe = /DROP POLICY\s+(?:IF EXISTS\s+)?"([^"]+)"\s+ON\s+public\.(\w+)/gi;
  while ((m = dropRe.exec(text))) {
    events.push({ fileOrder, kind: "DROP", table: m[2], name: m[1], statementText: "" });
  }

  // Sort by position within the file so CREATE-then-DROP-then-CREATE
  // sequences inside a single migration replay in the right order.
  events.sort((a, b) => text.indexOf(a.name) - text.indexOf(b.name));
  return events;
}

function isUnconditionallyPermissive(statementText: string): boolean {
  const normalized = statementText.replace(/\s+/g, " ").toLowerCase();
  return /using\s*\(\s*true\s*\)/.test(normalized) || /with check\s*\(\s*true\s*\)/.test(normalized);
}

describe("RLS policy audit (replays migration history)", () => {
  const files = loadMigrationFiles();
  const live = new Map<string, PolicyEvent>(); // key: `${table}::${name}`

  files.forEach((file, fileOrder) => {
    const text = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const event of extractEvents(fileOrder, text)) {
      const key = `${event.table}::${event.name}`;
      if (event.kind === "DROP") {
        live.delete(key);
      } else {
        live.set(key, event);
      }
    }
  });

  it("found at least one migration file to audit", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("leaves no unconditionally-permissive policy live on a crossover-sensitive table", () => {
    const offenders: string[] = [];
    for (const [key, event] of live) {
      if (!MUST_NEVER_BE_UNCONDITIONALLY_PERMISSIVE.has(event.table)) continue;
      if (isUnconditionallyPermissive(event.statementText)) {
        offenders.push(`${key} (created in ${files[event.fileOrder]})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // Historical regression: these three were created with USING (true) in
  // 20260126164901 and silently survived every later "close the hole"
  // migration until 20260806120000 explicitly dropped them. Pin them by
  // name so a future rename/refactor can't reintroduce the same gap
  // unnoticed.
  it.each([
    ["outings", "Anyone can view outings"],
    ["outings", "Anyone can log outings"],
    ["outings", "Anyone can update outings"],
    ["outings", "Anyone can delete outings"],
    ["pitchers", "Anyone can view pitchers"],
    ["pitchers", "Anyone can add pitchers"],
    ["pitchers", "Anyone can update pitchers"],
    ["pitchers", "Anyone can delete pitchers"],
    ["pitchers", "Public can view pitchers"],
    ["outings", "Public can view outings"],
    ["pitch_locations", "Public can view pitch_locations"],
    ["pitchers", "Public can view pitchers by id"],
    ["outings", "Public can view outings by pitcher"],
    ["pitch_locations", "Public can view pitch_locations by pitcher"],
    ["teams", "Public can view team leaderboard dates"],
    ["games", "Public can view games"],
    ["game_pitches", "Public can view game_pitches"],
    ["user_approvals", "Anyone can check approval"],
    ["workout_assignments", "Public can view workout_assignments by pitcher"],
    ["workout_completions", "Anyone can view workout_completions"],
    ["workout_completions", "Anyone can create workout_completions"],
    ["workout_completions", "Anyone can update workout_completions"],
    ["workout_completions", "Anyone can delete workout_completions"],
  ])("known-bad policy %s.%s is not live", (table, name) => {
    expect(live.has(`${table}::${name}`)).toBe(false);
  });
});
