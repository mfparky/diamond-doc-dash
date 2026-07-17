import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { usePitchers } from '@/hooks/use-pitchers';
import { useAuth } from '@/hooks/use-auth';
import { calculateRestStatus, parseLocalDateAtNoon, type RestStatus } from '@/types/pitcher';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Undo2, Check, ChevronDown, ChevronUp, LogOut, AlertTriangle, X } from 'lucide-react';
import { usePageMeta } from '@/hooks/use-page-meta';

type Outcome = 'ball' | 'strike' | 'foul' | 'in_play_safe' | 'in_play_out' | 'ab_end';

interface GameRow {
  id: string;
  date: string;
  opponent_name: string | null;
  status: string;
  team_id: string | null;
  user_id: string | null;
}

type Half = 'top' | 'bot';

interface PitchRow {
  id: string;
  pitcher_id: string | null;
  pitcher_name: string;
  inning: number;
  // In-memory only — not persisted to DB. UI uses it for the Top/Bot label and outs scoping
  // during a session; on reload it defaults to 'top'.
  half?: Half | null;
  is_strike: boolean;
  is_opponent: boolean;
  opponent_jersey: string | null;
  sequence: number;
  outcome: Outcome | null;
}

type Side = 'us' | 'opp';

const halfLabel = (h: Half) => (h === 'top' ? 'Top' : 'Bot');
const nextHalf = (inning: number, half: Half): { inning: number; half: Half } =>
  half === 'top' ? { inning, half: 'bot' } : { inning: inning + 1, half: 'top' };
const prevHalf = (inning: number, half: Half): { inning: number; half: Half } =>
  half === 'bot' ? { inning, half: 'top' } : { inning: Math.max(1, inning - 1), half: 'bot' };

const OPP_KEY_PREFIX = 'opp:';
const opponentLabel = (jersey: string) => `Opp #${jersey}`;

// Youth pitch-limit thresholds (mirrors getDaysRestNeeded in types/pitcher.ts).
const PITCH_WARN_YELLOW = 31;  // first rest day kicks in
const PITCH_WARN_ORANGE = 46;
const PITCH_WARN_RED = 76;     // 4-day rest territory

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pitchCountClass(n: number) {
  if (n >= PITCH_WARN_RED) return 'text-red-600 dark:text-red-400';
  if (n >= PITCH_WARN_ORANGE) return 'text-orange-600 dark:text-orange-400';
  if (n >= PITCH_WARN_YELLOW) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-foreground';
}

function vibrate(ms = 10) {
  // Best-effort haptic; no-op on unsupported browsers (iOS Safari).
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(ms); } catch { /* ignore */ }
  }
}

// Walk a pitcher's pitches in order to compute at-bat results & current BSO state
interface AtBatStats {
  bbs: number;
  ks: number;
  outs: number;
  hits: number;
  curBalls: number;
  curStrikes: number;
}

function computeAtBatStats(pitches: { outcome: Outcome | null; is_strike: boolean }[]): AtBatStats {
  let bbs = 0, ks = 0, outs = 0, hits = 0;
  let b = 0, s = 0;
  for (const p of pitches) {
    const o: Outcome = p.outcome ?? (p.is_strike ? 'strike' : 'ball');
    if (o === 'ball') {
      b++;
      if (b >= 4) { bbs++; b = 0; s = 0; }
    } else if (o === 'strike') {
      s++;
      if (s >= 3) { ks++; outs++; b = 0; s = 0; }
    } else if (o === 'foul') {
      if (s < 2) s++;
    } else if (o === 'in_play_safe') {
      hits++; b = 0; s = 0;
    } else if (o === 'in_play_out') {
      outs++; b = 0; s = 0;
    } else if (o === 'ab_end') {
      b = 0; s = 0;
    }
  }
  return { bbs, ks, outs, hits, curBalls: b, curStrikes: s };
}

// Rank rest statuses so unavailable pitchers fall to the bottom of the dropdown.
function restSortRank(status?: RestStatus): number {
  if (!status) return 1;
  if (status.type === 'active' || status.type === 'no-data') return 0;
  if (status.type === 'resting') return 1;
  if (status.type === 'threw-today') return 2;
  return 1;
}

function restIsRisky(status?: RestStatus): boolean {
  if (!status) return false;
  return status.type === 'threw-today' || status.type === 'resting';
}

export default function GameModePage() {
  usePageMeta({ title: 'Game Mode | Arm Stats', description: 'Live pitch-by-pitch counter for games.' });

  // Lock viewport zoom so iOS auto-zoom on input focus can't push UI past the viewport.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const original = meta.getAttribute('content') || '';
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    return () => { meta.setAttribute('content', original); };
  }, []);

  const { gameId: paramGameId } = useParams<{ gameId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pitchers, isLoading: pitchersLoading } = usePitchers();
  const { signOut } = useAuth();

  const [game, setGame] = useState<GameRow | null>(null);
  const [pitches, setPitches] = useState<PitchRow[]>([]);
  const [side, setSide] = useState<Side>('us');
  const [activePitcherId, setActivePitcherId] = useState<string>('');
  const [oppJersey, setOppJersey] = useState<string>('');
  const [currentInning, setCurrentInning] = useState(1);
  const [currentHalf, setCurrentHalf] = useState<Half>('top');
  const [busy, setBusy] = useState(false);

  // Setup form
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(todayISO());

  // UX state
  const [selectorOpen, setSelectorOpen] = useState(true);
  const [pendingPitcherId, setPendingPitcherId] = useState<string | null>(null);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [inningAdvanceOpen, setInningAdvanceOpen] = useState(false);
  const halfPromptedRef = useRef<string | null>(null);

  // Per-pitcher rest status, derived from each pitcher's most recent outing.
  const [restByPitcher, setRestByPitcher] = useState<Record<string, RestStatus>>({});
  useEffect(() => {
    if (pitchers.length === 0) return;
    let cancelled = false;
    (async () => {
      const names = pitchers.map(p => p.name);
      const { data } = await supabase
        .from('outings')
        .select('pitcher_name, date, pitch_count, created_at')
        .in('pitcher_name', names)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (cancelled || !data) return;
      const lastByName = new Map<string, { date: string; pitch_count: number; created_at: string }>();
      for (const o of data) {
        if (!o.pitcher_name) continue;
        const current = lastByName.get(o.pitcher_name);
        if (!current || parseLocalDateAtNoon(o.date).getTime() > parseLocalDateAtNoon(current.date).getTime()) {
          lastByName.set(o.pitcher_name, { date: o.date, pitch_count: o.pitch_count, created_at: o.created_at });
        } else if (current.date === o.date) {
          current.pitch_count += o.pitch_count;
          if (new Date(o.created_at).getTime() > new Date(current.created_at).getTime()) {
            current.created_at = o.created_at;
          }
        }
      }
      const map: Record<string, RestStatus> = {};
      for (const p of pitchers) {
        const last = lastByName.get(p.name);
        map[p.id] = calculateRestStatus(last?.date ?? null, last?.pitch_count ?? 0);
      }
      setRestByPitcher(map);
    })();
    return () => { cancelled = true; };
  }, [pitchers]);

  const restDot = (status?: RestStatus, big = false) => {
    if (!status) return null;
    const cls =
      status.type === 'active' ? 'bg-emerald-500'
      : status.type === 'threw-today' ? 'bg-red-500'
      : status.type === 'resting'
        ? (status.daysNeeded >= 4 ? 'bg-red-500'
          : status.daysNeeded === 3 ? 'bg-orange-500'
          : status.daysNeeded === 2 ? 'bg-yellow-500'
          : 'bg-slate-400')
      : 'bg-muted';
    return <span className={`inline-block rounded-full shrink-0 ${big ? 'w-3 h-3' : 'w-2 h-2'} ${cls}`} />;
  };
  const restSuffix = (status?: RestStatus) => {
    if (!status) return '';
    if (status.type === 'resting') return ` · Rest ${status.daysCurrent}/${status.daysNeeded}`;
    if (status.type === 'threw-today') return ' · Threw today';
    return '';
  };

  useEffect(() => {
    if (!paramGameId) return;
    let cancelled = false;
    (async () => {
      const { data: g } = await supabase.from('games').select('*').eq('id', paramGameId).maybeSingle();
      if (!g || cancelled) return;
      setGame(g as GameRow);
      const { data: ps } = await supabase
        .from('game_pitches')
        .select('*')
        .eq('game_id', paramGameId)
        .order('sequence', { ascending: true });
      if (cancelled) return;
      const rows = (ps || []) as PitchRow[];
      setPitches(rows);
      if (rows.length) {
        const last = rows[rows.length - 1];
        setCurrentInning(last.inning);
        setCurrentHalf(last.half === 'bot' ? 'bot' : 'top');
        if (last.is_opponent && last.opponent_jersey) {
          setSide('opp');
          setOppJersey(last.opponent_jersey);
        } else if (last.pitcher_id) {
          setSide('us');
          setActivePitcherId(last.pitcher_id);
        }
        setSelectorOpen(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paramGameId]);

  const startGame = useCallback(async () => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Sign in required', variant: 'destructive' });
        return;
      }
      const teamId = pitchers.find(p => p.teamId)?.teamId ?? null;
      const { data, error } = await supabase
        .from('games')
        .insert({
          date,
          opponent_name: opponent.trim() || null,
          status: 'in_progress',
          user_id: user.id,
          team_id: teamId,
        })
        .select()
        .single();
      if (error) throw error;
      setGame(data as GameRow);
      navigate(`/counter/${data.id}`, { replace: true });
    } catch (e) {
      toast({ title: 'Could not start game', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }, [date, opponent, pitchers, navigate, toast]);

  // Try to select a pitcher; if they have insufficient rest, intercept.
  const trySelectPitcher = useCallback((pid: string) => {
    const status = restByPitcher[pid];
    if (restIsRisky(status)) {
      setPendingPitcherId(pid);
      return;
    }
    setActivePitcherId(pid);
    setSelectorOpen(false);
  }, [restByPitcher]);

  const confirmRiskyPitcher = useCallback(() => {
    if (!pendingPitcherId) return;
    setActivePitcherId(pendingPitcherId);
    setPendingPitcherId(null);
    setSelectorOpen(false);
  }, [pendingPitcherId]);

  const logPitch = useCallback(async (outcome: Outcome) => {
    if (!game) return;
    const isStrike = outcome !== 'ball' && outcome !== 'ab_end';
    const sequence = pitches.length + 1;
    vibrate(10);

    let optimistic: PitchRow;
    let insertPayload: TablesInsert<'game_pitches'>;

    if (side === 'us') {
      if (!activePitcherId) return;
      const pitcher = pitchers.find(p => p.id === activePitcherId);
      if (!pitcher) return;
      optimistic = {
        id: `tmp-${sequence}`,
        pitcher_id: pitcher.id,
        pitcher_name: pitcher.name,
        inning: currentInning,
        half: currentHalf,
        is_strike: isStrike,
        is_opponent: false,
        opponent_jersey: null,
        sequence,
        outcome,
      };
      insertPayload = {
        game_id: game.id,
        pitcher_id: pitcher.id,
        pitcher_name: pitcher.name,
        inning: currentInning,
        is_strike: isStrike,
        is_opponent: false,
        opponent_jersey: null,
        sequence,
        outcome,
        team_id: game.team_id,
        user_id: game.user_id,
      };
    } else {
      const jersey = oppJersey.trim();
      if (!jersey) return;
      const name = opponentLabel(jersey);
      optimistic = {
        id: `tmp-${sequence}`,
        pitcher_id: null,
        pitcher_name: name,
        inning: currentInning,
        half: currentHalf,
        is_strike: isStrike,
        is_opponent: true,
        opponent_jersey: jersey,
        sequence,
        outcome,
      };
      insertPayload = {
        game_id: game.id,
        pitcher_id: null,
        pitcher_name: name,
        inning: currentInning,
        is_strike: isStrike,
        is_opponent: true,
        opponent_jersey: jersey,
        sequence,
        outcome,
        team_id: game.team_id,
        user_id: game.user_id,
      };
    }

    setPitches(prev => [...prev, optimistic]);
    const { data, error } = await supabase
      .from('game_pitches')
      .insert(insertPayload)
      .select()
      .single();
    if (error) {
      setPitches(prev => prev.filter(p => p.id !== optimistic.id));
      toast({ title: 'Pitch not saved', description: error.message, variant: 'destructive' });
      return;
    }
    // Carry the in-session `half` across the DB → state swap.
    setPitches(prev => prev.map(p => {
      if (p.id !== optimistic.id) return p;
      return { ...(data as PitchRow), half: optimistic.half };
    }));
  }, [game, side, activePitcherId, oppJersey, pitchers, pitches.length, currentInning, currentHalf, toast]);

  const undoLast = useCallback(async () => {
    if (!pitches.length) return;
    vibrate(15);
    const last = pitches[pitches.length - 1];
    setPitches(prev => prev.slice(0, -1));
    if (!last.id.startsWith('tmp-')) {
      await supabase.from('game_pitches').delete().eq('id', last.id);
    }
  }, [pitches]);

  const performFinish = useCallback(async () => {
    if (!game) return;
    setBusy(true);
    try {
      const byPitcher = new Map<string, { name: string; rows: PitchRow[] }>();
      pitches.forEach(p => {
        if (p.is_opponent || !p.pitcher_id) return;
        const cur = byPitcher.get(p.pitcher_id) || { name: p.pitcher_name, rows: [] };
        cur.rows.push(p);
        byPitcher.set(p.pitcher_id, cur);
      });

      const { data: { user } } = await supabase.auth.getUser();
      const outingRows = Array.from(byPitcher.entries()).map(([pid, agg]) => {
        const countable = agg.rows.filter(r => r.outcome !== 'ab_end');
        const pcount = countable.length;
        const strikes = countable.filter(r => r.is_strike).length;
        const ab = computeAtBatStats(agg.rows);
        const noteParts = [
          game.opponent_name ? `Game vs ${game.opponent_name}` : 'Game',
          `${ab.ks} K`,
          `${ab.bbs} BB`,
        ];
        return {
          pitcher_id: pid,
          pitcher_name: agg.name,
          date: game.date,
          event_type: 'Game',
          pitch_count: pcount,
          strikes,
          max_velocity: 0,
          notes: noteParts.join(' · '),
          team_id: game.team_id,
          user_id: user?.id ?? game.user_id,
          game_id: game.id,
        };
      });

      // Make finish idempotent: any existing outings linked to this game get rebuilt
      // from the current game_pitches state. The outing rows then become the
      // canonical source of truth that drives the post-game review.
      const { error: delErr } = await supabase.from('outings').delete().eq('game_id', game.id);
      if (delErr) throw delErr;

      if (outingRows.length) {
        const { error: oErr } = await supabase.from('outings').insert(outingRows);
        if (oErr) throw oErr;
      }

      const { error } = await supabase.from('games').update({ status: 'completed' }).eq('id', game.id);
      if (error) throw error;

      toast({ title: 'Game saved', description: `${outingRows.length} outing${outingRows.length === 1 ? '' : 's'} added to Arm Tracker.` });
      navigate(`/game-log/${game.id}`);
    } catch (e) {
      toast({ title: 'Could not finish game', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
      setFinishConfirmOpen(false);
    }
  }, [game, pitches, navigate, toast]);

  const totals = useMemo(() => {
    const countable = pitches.filter(p => p.outcome !== 'ab_end');
    const total = countable.length;
    const strikes = countable.filter(p => p.is_strike).length;
    return { total, strikes, balls: total - strikes, pct: total ? Math.round((strikes / total) * 100) : 0 };
  }, [pitches]);

  const activeKey = side === 'us'
    ? activePitcherId
    : (oppJersey.trim() ? `${OPP_KEY_PREFIX}${oppJersey.trim()}` : '');

  const activeSubjectLabel = side === 'us'
    ? (pitchers.find(p => p.id === activePitcherId)?.name ?? '')
    : (oppJersey.trim() ? opponentLabel(oppJersey.trim()) : '');

  const activePitches = useMemo(() => pitches.filter(p => {
    if (side === 'us') return !p.is_opponent && p.pitcher_id === activePitcherId;
    return p.is_opponent && p.opponent_jersey === oppJersey.trim();
  }), [pitches, side, activePitcherId, oppJersey]);

  const activeStats = useMemo(() => {
    if (!activeKey) return null;
    const countable = activePitches.filter(p => p.outcome !== 'ab_end');
    const total = countable.length;
    const strikes = countable.filter(p => p.is_strike).length;
    const ab = computeAtBatStats(activePitches);
    const decisions = ab.bbs + ab.ks;
    return {
      total,
      strikes,
      pct: total ? Math.round((strikes / total) * 100) : 0,
      ...ab,
      bbPct: decisions ? +(ab.bbs / decisions * 100).toFixed(1) : 0,
      kPct: decisions ? +(ab.ks / decisions * 100).toFixed(1) : 0,
    };
  }, [activePitches, activeKey]);

  // Outs in the current half-inning — drives auto-advance prompt.
  // Legacy rows without a half value are treated as 'top'.
  const outsThisHalf = useMemo(() => {
    const inHalf = pitches.filter(p => {
      if (p.inning !== currentInning) return false;
      const ph: Half = p.half === 'bot' ? 'bot' : 'top';
      return ph === currentHalf;
    });
    return computeAtBatStats(inHalf).outs;
  }, [pitches, currentInning, currentHalf]);

  // Prompt to advance once outs reach 3 (per inning, per half).
  useEffect(() => {
    const key = `${currentInning}-${currentHalf}`;
    if (outsThisHalf >= 3 && halfPromptedRef.current !== key) {
      halfPromptedRef.current = key;
      setInningAdvanceOpen(true);
    }
  }, [outsThisHalf, currentInning, currentHalf]);

  const advanceHalf = useCallback(() => {
    const next = nextHalf(currentInning, currentHalf);
    setCurrentInning(next.inning);
    setCurrentHalf(next.half);
    setInningAdvanceOpen(false);
  }, [currentInning, currentHalf]);

  const stepInning = useCallback((dir: 1 | -1) => {
    const next = dir === 1 ? nextHalf(currentInning, currentHalf) : prevHalf(currentInning, currentHalf);
    // Reset prompt tracking so the next half-end will re-prompt.
    halfPromptedRef.current = null;
    setCurrentInning(next.inning);
    setCurrentHalf(next.half);
  }, [currentInning, currentHalf]);

  // Last-pitch chip
  const lastPitch = pitches.length ? pitches[pitches.length - 1] : null;
  const lastPitchLabel = useMemo(() => {
    if (!lastPitch) return '';
    const o = lastPitch.outcome ?? (lastPitch.is_strike ? 'strike' : 'ball');
    const labels: Record<Outcome, string> = {
      ball: 'Ball', strike: 'Strike', foul: 'Foul',
      in_play_safe: 'In Play – Safe', in_play_out: 'In Play – Out', ab_end: 'AB End',
    };
    return labels[o];
  }, [lastPitch]);

  // Tally — both teams, click to switch active pitcher.
  const tally = useMemo(() => {
    type Row = { key: string; name: string; isOpponent: boolean; pitcherId: string | null; jersey: string | null; pitches: number; strikes: number; bbs: number; ks: number };
    const map = new Map<string, Row>();
    const grouped = new Map<string, PitchRow[]>();
    pitches.forEach(p => {
      const key = p.is_opponent
        ? `${OPP_KEY_PREFIX}${p.opponent_jersey ?? ''}`
        : (p.pitcher_id ?? p.pitcher_name);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(p);
      if (!map.has(key)) {
        map.set(key, {
          key, name: p.pitcher_name, isOpponent: p.is_opponent,
          pitcherId: p.is_opponent ? null : p.pitcher_id,
          jersey: p.is_opponent ? p.opponent_jersey : null,
          pitches: 0, strikes: 0, bbs: 0, ks: 0,
        });
      }
    });
    grouped.forEach((rows, key) => {
      const r = map.get(key)!;
      const countable = rows.filter(x => x.outcome !== 'ab_end');
      r.pitches = countable.length;
      r.strikes = countable.filter(x => x.is_strike).length;
      const ab = computeAtBatStats(rows);
      r.bbs = ab.bbs;
      r.ks = ab.ks;
    });
    return Array.from(map.values())
      .map(r => ({ ...r, pct: r.pitches ? Math.round((r.strikes / r.pitches) * 100) : 0 }))
      .sort((a, b) => Number(a.isOpponent) - Number(b.isOpponent) || b.pitches - a.pitches);
  }, [pitches]);

  // Has any of our pitchers crossed the high-warning threshold?
  const overLimit = useMemo(() => tally.find(t => !t.isOpponent && t.pitches >= PITCH_WARN_RED), [tally]);

  // Recent opponent jerseys for quick-select chips.
  const recentJerseys = useMemo(() => {
    const seen: string[] = [];
    for (let i = pitches.length - 1; i >= 0; i--) {
      const p = pitches[i];
      if (p.is_opponent && p.opponent_jersey && !seen.includes(p.opponent_jersey)) {
        seen.push(p.opponent_jersey);
      }
      if (seen.length >= 8) break;
    }
    return seen;
  }, [pitches]);

  const canLog = side === 'us' ? !!activePitcherId : !!oppJersey.trim();

  // Sort pitchers — healthy first, threw-today last.
  const sortedPitchers = useMemo(() => {
    return [...pitchers].sort((a, b) => {
      const ra = restSortRank(restByPitcher[a.id]);
      const rb = restSortRank(restByPitcher[b.id]);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [pitchers, restByPitcher]);

  const switchToTallyRow = (row: { isOpponent: boolean; pitcherId: string | null; jersey: string | null }) => {
    if (row.isOpponent && row.jersey) {
      setSide('opp');
      setOppJersey(row.jersey);
      setSelectorOpen(false);
    } else if (row.pitcherId) {
      setSide('us');
      // Use risk-check path so red dots still prompt confirmation.
      trySelectPitcher(row.pitcherId);
    }
  };

  // ---- Setup screen ----
  if (!game) {
    return (
      <div className="h-[100dvh] w-full bg-background p-4 overflow-y-auto overflow-x-hidden">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4 gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
          <Card>
            <CardHeader><CardTitle>Start a Game</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="game-date">Date</Label>
                <Input id="game-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="block w-full h-11 text-base appearance-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="game-opp">Opponent (optional)</Label>
                <Input id="game-opp" value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="e.g. Markham Mariners" className="h-11 text-base" />
              </div>
              <Button className="w-full h-12" onClick={startGame} disabled={busy || pitchersLoading}>
                Start Game
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // BSO display — bigger, B/S/O column-style with text labels for color-blind use.
  const BsoDots = ({ filled, max, color, letter }: { filled: number; max: number; color: string; letter: string }) => (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-bold text-muted-foreground w-3 tabular-nums" aria-hidden>{letter}</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`inline-block w-3.5 h-3.5 rounded-full border-2 ${i < filled ? `${color} border-transparent` : 'bg-transparent border-muted-foreground/40'}`}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden touch-pan-y">
      {/* Header (fixed) */}
      <div className="px-3 py-2 border-b border-border bg-card flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/game-log')} className="px-2 shrink-0">
          <ArrowLeft className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Games</span>
        </Button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[11px] text-muted-foreground leading-none">{game.date}</p>
          <p className="font-semibold text-sm truncate">{game.opponent_name || 'Game'}</p>
        </div>
        <Button size="sm" variant="default" onClick={() => setFinishConfirmOpen(true)} disabled={busy || pitches.length === 0} className="px-2 shrink-0">
          <Check className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Finish</span>
        </Button>
      </div>

      {/* Over-limit banner */}
      {overLimit && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-xs font-semibold text-red-700 dark:text-red-300 truncate">
            {overLimit.name} at {overLimit.pitches} pitches — past 4-day-rest limit
          </p>
        </div>
      )}

      {/* Scrollable middle: pitcher selector + tally */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        {/* Collapsible active-pitcher selector */}
        <div className="px-3 pt-3 pb-2 border-b border-border">
          {!selectorOpen && activeSubjectLabel ? (
            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary/60 active:bg-secondary"
              style={{ touchAction: 'manipulation' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {side === 'us' && restDot(restByPitcher[activePitcherId])}
                <span className="font-semibold truncate">{activeSubjectLabel}</span>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                {halfLabel(currentHalf)} {currentInning} <ChevronDown className="w-4 h-4" />
              </span>
            </button>
          ) : (
            <div className="space-y-2">
              {/* Inline side toggle inside selector */}
              <div className="grid grid-cols-2 rounded-lg bg-secondary p-1 text-sm font-semibold">
                <button type="button" onClick={() => setSide('us')}
                  className={`h-9 rounded-md transition-colors ${side === 'us' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                  style={{ touchAction: 'manipulation' }}>
                  Our Pitcher
                </button>
                <button type="button" onClick={() => setSide('opp')}
                  className={`h-9 rounded-md transition-colors ${side === 'opp' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                  style={{ touchAction: 'manipulation' }}>
                  Opponent
                </button>
              </div>

              {side === 'us' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Pitcher</Label>
                    {activeSubjectLabel && (
                      <button type="button" onClick={() => setSelectorOpen(false)} className="text-xs text-muted-foreground flex items-center gap-1">
                        Collapse <ChevronUp className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {sortedPitchers.map(p => {
                      const status = restByPitcher[p.id];
                      const isActive = p.id === activePitcherId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => trySelectPitcher(p.id)}
                          style={{ touchAction: 'manipulation' }}
                          className={`px-2 py-2 rounded-lg border text-left text-sm font-medium min-w-0 ${
                            isActive ? 'bg-primary/10 border-primary text-foreground' : 'bg-card border-border'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            {restDot(status)}
                            <span className="truncate">{p.name}</span>
                          </span>
                          {restSuffix(status) && (
                            <span className="block text-[10px] text-muted-foreground truncate">{restSuffix(status).replace(' · ', '')}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Opponent jersey #</Label>
                    {activeSubjectLabel && (
                      <button type="button" onClick={() => setSelectorOpen(false)} className="text-xs text-muted-foreground flex items-center gap-1">
                        Collapse <ChevronUp className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {recentJerseys.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recentJerseys.map(j => (
                        <button
                          key={j}
                          type="button"
                          onClick={() => { setOppJersey(j); setSelectorOpen(false); }}
                          style={{ touchAction: 'manipulation' }}
                          className={`px-3 py-1.5 rounded-full border text-sm font-bold min-w-[3rem] tabular-nums ${
                            oppJersey === j ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border'
                          }`}
                        >
                          #{j}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-11 w-11"
                      onClick={() => setOppJersey(j => String(Math.max(0, (parseInt(j || '0', 10) || 0) - 1)))}>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Input type="number" inputMode="numeric" pattern="[0-9]*" min={0}
                      value={oppJersey}
                      onChange={e => setOppJersey(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="#"
                      className="h-11 text-center text-lg font-bold tabular-nums" />
                    <Button type="button" variant="outline" size="icon" className="h-11 w-11"
                      onClick={() => setOppJersey(j => String((parseInt(j || '0', 10) || 0) + 1))}>
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tally */}
        <div className="px-3 py-3">
          <div className="rounded-lg border border-border bg-card">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All Pitchers</p>
              <p className="text-[11px] text-muted-foreground">Tap to switch · {tally.length} tracked</p>
            </div>
            {tally.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">No pitches logged yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {tally.map(row => {
                  const isActive = row.key === activeKey;
                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        onClick={() => switchToTallyRow(row)}
                        style={{ touchAction: 'manipulation' }}
                        className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-left active:bg-secondary/60 ${isActive ? 'bg-secondary/40' : ''}`}
                      >
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                          row.isOpponent ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' : 'bg-primary/15 text-primary'
                        }`}>{row.isOpponent ? 'Opp' : 'Us'}</span>
                        <span className="font-semibold truncate flex-1 min-w-0">{row.name}</span>
                        <span className={`font-bold tabular-nums shrink-0 ${row.isOpponent ? '' : pitchCountClass(row.pitches)}`}>{row.pitches}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0 w-16 text-right">{row.ks}K/{row.bbs}BB</span>
                        <span className="text-primary font-semibold tabular-nums shrink-0 w-12 text-right">{row.pct}%</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Pinned action panel */}
      <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {/* BSO + inning controls (sticky) */}
        {activeSubjectLabel && activeStats && (
          <div className="px-3 py-2 border-b border-border bg-secondary/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <BsoDots filled={activeStats.curBalls} max={3} color="bg-emerald-500" letter="B" />
                <BsoDots filled={activeStats.curStrikes} max={2} color="bg-orange-500" letter="S" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground">O</span>
                  <span className="text-base font-bold tabular-nums">{outsThisHalf}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => stepInning(-1)}>
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <span className="text-sm font-bold w-14 text-center tabular-nums">
                  {halfLabel(currentHalf)} {currentInning}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => stepInning(1)}>
                  <ChevronUp className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {lastPitchLabel && (
              <p className="text-[10px] text-muted-foreground mt-1 text-center">
                Last: <span className="font-semibold text-foreground">{lastPitchLabel}</span>
                {' · '}<span className={pitchCountClass(activeStats.total)}>{activeStats.total} pitches</span>
                {' · '}{activeStats.pct}% K
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="p-2 space-y-2">
          {/* Row 1: PRIMARY — Ball / Strike (the 80% case) */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => logPitch('ball')} disabled={!canLog}
              style={{ touchAction: 'manipulation' }}
              className="h-20 rounded-2xl bg-slate-700 text-white text-2xl font-extrabold active:scale-95 transition-transform disabled:opacity-40 shadow-lg">
              BALL
            </button>
            <button type="button" onClick={() => logPitch('strike')} disabled={!canLog}
              style={{ touchAction: 'manipulation' }}
              className="h-20 rounded-2xl bg-emerald-600 text-white text-2xl font-extrabold active:scale-95 transition-transform disabled:opacity-40 shadow-lg">
              STRIKE
            </button>
          </div>

          {/* Row 2: SECONDARY — Foul / In Play */}
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => logPitch('foul')} disabled={!canLog}
              style={{ touchAction: 'manipulation' }}
              className="h-12 rounded-xl bg-secondary text-foreground text-sm font-bold active:scale-95 transition-transform disabled:opacity-40 border border-border shadow">
              Foul
            </button>
            <button type="button" onClick={() => logPitch('in_play_safe')} disabled={!canLog}
              style={{ touchAction: 'manipulation' }}
              className="h-12 rounded-xl bg-secondary text-foreground text-sm font-bold active:scale-95 transition-transform disabled:opacity-40 border border-border shadow">
              In Play – Safe
            </button>
            <button type="button" onClick={() => logPitch('in_play_out')} disabled={!canLog}
              style={{ touchAction: 'manipulation' }}
              className="h-12 rounded-xl bg-secondary text-foreground text-sm font-bold active:scale-95 transition-transform disabled:opacity-40 border border-border shadow">
              In Play – Out
            </button>
          </div>

          {/* Row 3: UTILITY — End AB (only mid-AB) + Undo */}
          <div className={`grid gap-2 ${activeStats && (activeStats.curBalls > 0 || activeStats.curStrikes > 0) ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {activeStats && (activeStats.curBalls > 0 || activeStats.curStrikes > 0) && (
              <button type="button" onClick={() => logPitch('ab_end')} disabled={!canLog}
                style={{ touchAction: 'manipulation' }}
                className="h-11 rounded-xl bg-accent text-accent-foreground text-sm font-bold active:scale-95 transition-transform disabled:opacity-40 border border-border shadow">
                End AB (HBP / Walk-off)
              </button>
            )}
            <button type="button" onClick={undoLast} disabled={pitches.length === 0}
              style={{ touchAction: 'manipulation' }}
              className="h-11 rounded-xl bg-background border border-border text-foreground text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-40 shadow">
              <Undo2 className="w-4 h-4" /> Undo last pitch
            </button>
          </div>

          <div className="text-[11px] text-muted-foreground text-center">
            Game total: <span className="font-bold text-foreground tabular-nums">{totals.total}</span>
            {' · '}<span className="text-primary font-bold">{totals.pct}% K</span>
          </div>
        </div>
      </div>

      {/* Rest-warning modal */}
      <AlertDialog open={pendingPitcherId !== null} onOpenChange={(o) => !o && setPendingPitcherId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Pitcher needs rest
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                if (!pendingPitcherId) return '';
                const p = pitchers.find(p => p.id === pendingPitcherId);
                const s = restByPitcher[pendingPitcherId];
                if (!p || !s) return '';
                if (s.type === 'threw-today') return `${p.name} already threw today. Re-using the same arm in the same day can push them past safe limits.`;
                if (s.type === 'resting') return `${p.name} is on day ${s.daysCurrent} of ${s.daysNeeded} required rest days. Continuing now risks overuse.`;
                return '';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Pick someone else</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRiskyPitcher} className="bg-yellow-600 hover:bg-yellow-700">
              Use anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finish-confirmation modal */}
      <AlertDialog open={finishConfirmOpen} onOpenChange={setFinishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish game?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This will close the game and rebuild outings for each of your pitchers — those outings become the source of truth for this game and feed Arm Tracker.</p>
                <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total pitches</span><span className="font-bold tabular-nums">{totals.total}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Strike %</span><span className="font-bold">{totals.pct}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Our pitchers</span><span className="font-bold tabular-nums">{tally.filter(t => !t.isOpponent).length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Opp pitchers</span><span className="font-bold tabular-nums">{tally.filter(t => t.isOpponent).length}</span></div>
                </div>
                <p className="text-xs text-muted-foreground">Tapping Finish again on a completed game safely re-syncs outings from the current pitch log.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              <X className="w-4 h-4 mr-1" /> Keep charting
            </AlertDialogCancel>
            <AlertDialogAction onClick={performFinish} disabled={busy}>
              <Check className="w-4 h-4 mr-1" /> {busy ? 'Saving…' : 'Finish & save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Half-inning auto-advance prompt */}
      <AlertDialog open={inningAdvanceOpen} onOpenChange={setInningAdvanceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End of {halfLabel(currentHalf).toLowerCase()} of {currentInning}?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const next = nextHalf(currentInning, currentHalf);
                return `3 outs recorded. Advance to ${halfLabel(next.half).toLowerCase()} of ${next.inning}?`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay on {halfLabel(currentHalf).toLowerCase()} {currentInning}</AlertDialogCancel>
            <AlertDialogAction onClick={advanceHalf}>
              {(() => {
                const next = nextHalf(currentInning, currentHalf);
                return `Advance to ${halfLabel(next.half).toLowerCase()} ${next.inning}`;
              })()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
