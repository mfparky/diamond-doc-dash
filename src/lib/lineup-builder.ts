import type { StatValue } from './stat-csv';

/**
 * Auto-generate a batting order from each candidate's snapshot stats.
 *
 * The rules deliberately favor rate stats over counting stats (a 12U kid who
 * bats behind a walker will always have inflated R+RBI) and lean on the
 * classic slot archetypes: high-OBP leadoff, contact 2, biggest bats 3-4,
 * RBI-producer 5, then descending OPS. The 9-hole gets a "second leadoff"
 * nudge (contact + speed).
 */

export interface LineupCandidate {
  pitcherId: string;
  pitcherName: string;
  /** Latest CSV snapshot stats (or null when the player has no upload). */
  stats: Record<string, StatValue> | null;
}

export interface BattingOrderSpot {
  order: number; // 1..N
  candidateId: string;
  candidateName: string;
  /** Which archetype rule filled this slot. */
  archetype: BattingArchetype;
  /** Coach-readable reason ("Owen has the highest OBP among today's bats"). */
  rationale: string;
  /** The single metric that anchored the pick, with its raw value. */
  driver: { key: string; label: string; value: number | null };
}

export type BattingArchetype =
  | 'leadoff'
  | 'contact-2'
  | 'best-bat-3'
  | 'cleanup-4'
  | 'rbi-5'
  | 'depth-6'
  | 'depth-7'
  | 'depth-8'
  | 'second-leadoff-9'
  | 'depth';

// --- Helpers ---

function num(stats: Record<string, StatValue> | null, key: string): number | null {
  if (!stats) return null;
  const v = stats[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** K% (SO / PA * 100). Lower is better. Returns null when missing data. */
function kPct(c: LineupCandidate): number | null {
  const so = num(c.stats, 'bat_so');
  const pa = num(c.stats, 'bat_pa');
  if (so === null || pa === null || pa <= 0) return null;
  return (so / pa) * 100;
}

/** RBI per PA. Higher is better. */
function rbiPerPa(c: LineupCandidate): number | null {
  const rbi = num(c.stats, 'bat_rbi');
  const pa = num(c.stats, 'bat_pa');
  if (rbi === null || pa === null || pa <= 0) return null;
  return rbi / pa;
}

/** Composite leadoff score: OBP with a K%-penalty tiebreak. */
function leadoffScore(c: LineupCandidate): number {
  const obp = num(c.stats, 'bat_obp') ?? 0;
  const k = kPct(c) ?? 100; // no data → treat as high K
  // Reward OBP, penalize K% at ~5% weight so it only tiebreaks.
  return obp * 100 - k * 0.05;
}

/** Contact-hitter score: QAB% with a low-K% bonus. */
function contactScore(c: LineupCandidate): number {
  const qab = num(c.stats, 'bat_qab_pct') ?? 0;
  const k = kPct(c) ?? 100;
  return qab - k * 0.5;
}

/** Second-leadoff score for the 9-hole: contact + speed nudge. */
function secondLeadoffScore(c: LineupCandidate): number {
  const obp = num(c.stats, 'bat_obp') ?? 0;
  const k = kPct(c) ?? 100;
  const sbPct = num(c.stats, 'bat_sb_pct') ?? 0;
  // OBP-weighted, penalized for K, small bump for stolen-base success.
  return obp * 80 - k * 0.05 + sbPct * 0.05;
}

// --- Picker helpers ---

function popBestBy<T>(pool: T[], score: (item: T) => number): T | null {
  if (pool.length === 0) return null;
  let bestIdx = 0;
  let bestScore = score(pool[0]);
  for (let i = 1; i < pool.length; i += 1) {
    const s = score(pool[i]);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  const [chosen] = pool.splice(bestIdx, 1);
  return chosen;
}

function driverForArchetype(archetype: BattingArchetype, c: LineupCandidate): BattingOrderSpot['driver'] {
  switch (archetype) {
    case 'leadoff':
      return { key: 'bat_obp', label: 'OBP', value: num(c.stats, 'bat_obp') };
    case 'contact-2':
      return { key: 'bat_qab_pct', label: 'QAB%', value: num(c.stats, 'bat_qab_pct') };
    case 'best-bat-3':
    case 'cleanup-4':
    case 'depth-6':
    case 'depth-7':
    case 'depth-8':
    case 'depth':
      return { key: 'bat_ops', label: 'OPS', value: num(c.stats, 'bat_ops') };
    case 'rbi-5':
      return { key: 'bat_rbi_per_pa', label: 'RBI/PA', value: rbiPerPa(c) };
    case 'second-leadoff-9':
      return { key: 'bat_obp', label: 'OBP', value: num(c.stats, 'bat_obp') };
  }
}

function rationaleForArchetype(archetype: BattingArchetype, c: LineupCandidate): string {
  const first = c.pitcherName.split(' ')[0] ?? c.pitcherName;
  const driver = driverForArchetype(archetype, c);
  const val = driver.value !== null ? driver.value.toFixed(driver.key.includes('per_pa') ? 3 : 3) : '—';

  switch (archetype) {
    case 'leadoff':
      return `${first} leads off — top OBP on the card (${val}). Sets the table.`;
    case 'contact-2':
      return `${first} in the 2-hole — grinds out at-bats (QAB% ${val}) and rarely gives one away.`;
    case 'best-bat-3':
      return `${first} bats third — biggest bat available (OPS ${val}).`;
    case 'cleanup-4':
      return `${first} cleans up — best OPS remaining (${val}) behind the 3-hole.`;
    case 'rbi-5':
      return `${first} at 5 — leads today's card in RBI/PA (${val}).`;
    case 'depth-6':
      return `${first} at 6 — best bat left after the top of the order (OPS ${val}).`;
    case 'depth-7':
      return `${first} at 7 — next-best OPS (${val}).`;
    case 'depth-8':
      return `${first} at 8 — filling out the middle of the card (OPS ${val}).`;
    case 'second-leadoff-9':
      return `${first} at 9 — second-leadoff role: OBP ${val}, sets up the top of the order.`;
    case 'depth':
      return `${first} — descending OPS (${val}).`;
  }
}

/**
 * Build a batting order from the players marked available today. The pool
 * is walked slot-by-slot: leadoff → contact 2 → best OPS 3 → best OPS
 * cleanup → RBI 5 → depth 6/7/8 → second-leadoff 9 → any remaining depth.
 *
 * The caller controls how many spots to fill (defaults to `available.length`,
 * i.e. one spot per player). Youth leagues that bat the whole lineup benefit
 * from that default; leagues that use a 9-spot card can cap at 9.
 */
export function buildBattingOrder(
  available: LineupCandidate[],
  spotCount = available.length,
): BattingOrderSpot[] {
  if (available.length === 0 || spotCount <= 0) return [];

  const pool = [...available];
  const spots: BattingOrderSpot[] = [];

  const assign = (order: number, archetype: BattingArchetype, chosen: LineupCandidate) => {
    spots.push({
      order,
      candidateId: chosen.pitcherId,
      candidateName: chosen.pitcherName,
      archetype,
      rationale: rationaleForArchetype(archetype, chosen),
      driver: driverForArchetype(archetype, chosen),
    });
  };

  const opsScore = (c: LineupCandidate) => num(c.stats, 'bat_ops') ?? -1;

  // Slot 1 — leadoff.
  const leadoff = popBestBy(pool, leadoffScore);
  if (leadoff) assign(1, 'leadoff', leadoff);

  // Slot 2 — contact.
  if (spots.length < spotCount) {
    const two = popBestBy(pool, contactScore);
    if (two) assign(2, 'contact-2', two);
  }

  // Slots 3 & 4 — best OPS.
  for (const [ord, arch] of [
    [3, 'best-bat-3'] as const,
    [4, 'cleanup-4'] as const,
  ]) {
    if (spots.length >= spotCount) break;
    const best = popBestBy(pool, opsScore);
    if (best) assign(ord, arch, best);
  }

  // Slot 5 — RBI producer.
  if (spots.length < spotCount) {
    const five = popBestBy(pool, (c) => rbiPerPa(c) ?? -1);
    if (five) assign(5, 'rbi-5', five);
  }

  // Slots 6 → 8 — descending OPS.
  for (const [ord, arch] of [
    [6, 'depth-6'] as const,
    [7, 'depth-7'] as const,
    [8, 'depth-8'] as const,
  ]) {
    if (spots.length >= spotCount) break;
    const next = popBestBy(pool, opsScore);
    if (next) assign(ord, arch, next);
  }

  // Slot 9 — second-leadoff for the whole-lineup bat-around leagues.
  if (spots.length < spotCount) {
    const nine = popBestBy(pool, secondLeadoffScore);
    if (nine) assign(9, 'second-leadoff-9', nine);
  }

  // Anyone left over — pure descending OPS.
  let slot = 10;
  while (pool.length > 0 && spots.length < spotCount) {
    const next = popBestBy(pool, opsScore);
    if (!next) break;
    assign(slot, 'depth', next);
    slot += 1;
  }

  return spots;
}

/**
 * Same shape as buildBattingOrder but honors a caller-provided manual order.
 * Used when the coach drags to reorder — we keep the ids but re-derive
 * rationales/archetypes for display so the "why" text stays sensible.
 */
export function applyManualOrder(
  ordered: LineupCandidate[],
): BattingOrderSpot[] {
  return ordered.map((c, idx) => {
    const order = idx + 1;
    const archetype: BattingArchetype =
      order === 1 ? 'leadoff' :
      order === 2 ? 'contact-2' :
      order === 3 ? 'best-bat-3' :
      order === 4 ? 'cleanup-4' :
      order === 5 ? 'rbi-5' :
      order === 6 ? 'depth-6' :
      order === 7 ? 'depth-7' :
      order === 8 ? 'depth-8' :
      order === 9 ? 'second-leadoff-9' :
      'depth';
    return {
      order,
      candidateId: c.pitcherId,
      candidateName: c.pitcherName,
      archetype,
      rationale: rationaleForArchetype(archetype, c),
      driver: driverForArchetype(archetype, c),
    };
  });
}
