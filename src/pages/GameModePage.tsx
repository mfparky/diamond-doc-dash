import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { usePitchers } from '@/hooks/use-pitchers';
import { useAuth } from '@/hooks/use-auth';
import { calculateRestStatus, parseLocalDateAtNoon, type RestStatus } from '@/types/pitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Undo2, Check, ChevronDown, ChevronUp, LogOut } from 'lucide-react';
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

interface PitchRow {
  id: string;
  pitcher_id: string | null;
  pitcher_name: string;
  inning: number;
  is_strike: boolean;
  is_opponent: boolean;
  opponent_jersey: string | null;
  sequence: number;
  outcome: Outcome | null;
}

type Side = 'us' | 'opp';

const OPP_KEY_PREFIX = 'opp:';
const opponentLabel = (jersey: string) => `Opp #${jersey}`;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Walk a pitcher's pitches in order to compute at-bat results & current BSO state
interface AtBatStats {
  bbs: number;
  ks: number;
  outs: number;
  hits: number; // in_play_safe approximations
  // current open at-bat
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

export default function GameModePage() {
  usePageMeta({ title: 'Game Mode | Arm Stats', description: 'Live pitch-by-pitch counter for games.' });

  // Lock viewport zoom while in Game Mode so iOS auto-zoom on input focus
  // (and accidental pinch) can't push UI past the viewport.
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
  const [busy, setBusy] = useState(false);

  // Setup form
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(todayISO());

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

  const restDot = (status?: RestStatus) => {
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
    return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cls}`} />;
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
        if (last.is_opponent && last.opponent_jersey) {
          setSide('opp');
          setOppJersey(last.opponent_jersey);
        } else if (last.pitcher_id) {
          setSide('us');
          setActivePitcherId(last.pitcher_id);
        }
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
      navigate(`/game/${data.id}`, { replace: true });
    } catch (e) {
      toast({ title: 'Could not start game', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }, [date, opponent, pitchers, navigate, toast]);

  const logPitch = useCallback(async (outcome: Outcome) => {
    if (!game) return;
    const isStrike = outcome !== 'ball' && outcome !== 'ab_end';
    const sequence = pitches.length + 1;

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
    setPitches(prev => prev.map(p => (p.id === optimistic.id ? (data as PitchRow) : p)));
  }, [game, side, activePitcherId, oppJersey, pitchers, pitches.length, currentInning, toast]);

  const undoLast = useCallback(async () => {
    if (!pitches.length) return;
    const last = pitches[pitches.length - 1];
    setPitches(prev => prev.slice(0, -1));
    if (!last.id.startsWith('tmp-')) {
      await supabase.from('game_pitches').delete().eq('id', last.id);
    }
  }, [pitches]);

  const finishGame = useCallback(async () => {
    if (!game) return;
    setBusy(true);
    try {
      // Aggregate per-pitcher (our side only)
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
        const pitches = countable.length;
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
          pitch_count: pitches,
          strikes,
          max_velocity: 0,
          notes: noteParts.join(' · '),
          team_id: game.team_id,
          user_id: user?.id ?? game.user_id,
        };
      });
      if (outingRows.length) {
        const { error: oErr } = await supabase.from('outings').insert(outingRows);
        if (oErr) throw oErr;
      }

      const { error } = await supabase
        .from('games')
        .update({ status: 'completed' })
        .eq('id', game.id);
      if (error) throw error;

      toast({ title: 'Game saved', description: `${outingRows.length} outing${outingRows.length === 1 ? '' : 's'} added to Arm Tracker.` });
      navigate(`/games/${game.id}`);
    } catch (e) {
      toast({ title: 'Could not finish game', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
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

  const activePitches = useMemo(() => {
    return pitches.filter(p => {
      if (side === 'us') return !p.is_opponent && p.pitcher_id === activePitcherId;
      return p.is_opponent && p.opponent_jersey === oppJersey.trim();
    });
  }, [pitches, side, activePitcherId, oppJersey]);

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

  // Tally
  const tally = useMemo(() => {
    type Row = { key: string; name: string; isOpponent: boolean; pitches: number; strikes: number; bbs: number; ks: number };
    const map = new Map<string, Row>();
    const grouped = new Map<string, PitchRow[]>();
    pitches.forEach(p => {
      const key = p.is_opponent
        ? `${OPP_KEY_PREFIX}${p.opponent_jersey ?? ''}`
        : (p.pitcher_id ?? p.pitcher_name);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(p);
      if (!map.has(key)) {
        map.set(key, { key, name: p.pitcher_name, isOpponent: p.is_opponent, pitches: 0, strikes: 0, bbs: 0, ks: 0 });
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

  const canLog = side === 'us' ? !!activePitcherId : !!oppJersey.trim();

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
            <CardHeader>
              <CardTitle>Start a Game</CardTitle>
            </CardHeader>
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

  const dot = (filled: boolean, color: string) => (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${filled ? color : 'bg-muted'}`} />
  );

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden touch-pan-y">
      {/* Header (fixed) */}
      <div className="px-3 py-2 border-b border-border bg-card flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/games')} className="px-2 shrink-0">
          <ArrowLeft className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Games</span>
        </Button>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[11px] text-muted-foreground leading-none">{game.date}</p>
          <p className="font-semibold text-sm truncate">{game.opponent_name || 'Game'}</p>
        </div>
        <Button size="sm" onClick={finishGame} disabled={busy || pitches.length === 0} className="px-2 shrink-0">
          <Check className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Finish</span>
        </Button>
      </div>

      {/* Scrollable middle: selectors, BSO, tally */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="px-3 pt-3">
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
        </div>

        <div className="px-3 pt-3 pb-2 space-y-2 border-b border-border">
          {side === 'us' ? (
            <div className="min-w-0">
              <Label className="text-xs">Pitcher</Label>
              <Select value={activePitcherId} onValueChange={setActivePitcherId}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Select pitcher">
                    {activePitcherId && (() => {
                      const p = pitchers.find(p => p.id === activePitcherId);
                      if (!p) return null;
                      return (
                        <span className="flex items-center gap-2 min-w-0">
                          {restDot(restByPitcher[p.id])}
                          <span className="truncate">{p.name}{restSuffix(restByPitcher[p.id])}</span>
                        </span>
                      );
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {pitchers.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {restDot(restByPitcher[p.id])}
                        <span>{p.name}{restSuffix(restByPitcher[p.id])}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="min-w-0">
              <Label className="text-xs">Opponent jersey #</Label>
              <Input type="number" inputMode="numeric" pattern="[0-9]*" min={0}
                value={oppJersey} onChange={e => setOppJersey(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 12" className="h-11 text-base w-full" />
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Inning</Label>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentInning(i => Math.max(1, i - 1))}>
                <ChevronDown className="w-4 h-4" />
              </Button>
              <span className="text-xl font-bold w-8 text-center">{currentInning}</span>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentInning(i => i + 1)}>
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {activeSubjectLabel && activeStats && (
          <div className="px-3 py-2 border-b border-border bg-secondary/30 space-y-2">
            <div className="flex items-center justify-center gap-5 text-sm font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">B</span>
                {dot(activeStats.curBalls >= 1, 'bg-emerald-500')}
                {dot(activeStats.curBalls >= 2, 'bg-emerald-500')}
                {dot(activeStats.curBalls >= 3, 'bg-emerald-500')}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">S</span>
                {dot(activeStats.curStrikes >= 1, 'bg-orange-500')}
                {dot(activeStats.curStrikes >= 2, 'bg-orange-500')}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">O</span>
                <span className="text-base font-bold tabular-nums">{activeStats.outs}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs max-w-xs mx-auto">
              <div className="flex justify-between"><span className="text-muted-foreground">Balls:</span><span className="font-bold">{activeStats.total - activeStats.strikes}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Strikes:</span><span className="font-bold">{activeStats.strikes}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">BBs:</span><span className="font-bold">{activeStats.bbs}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ks:</span><span className="font-bold">{activeStats.ks}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">BB%:</span><span className="font-bold">{activeStats.bbPct}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">K%:</span><span className="font-bold">{activeStats.kPct}%</span></div>
            </div>
            <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground truncate">{activeSubjectLabel}</p>
          </div>
        )}

        {/* Tally */}
        <div className="px-3 py-3">
          <div className="rounded-lg border border-border bg-card">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All Pitchers</p>
              <p className="text-[11px] text-muted-foreground">{tally.length} tracked</p>
            </div>
            {tally.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">No pitches logged yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {tally.map(row => {
                  const isActive = row.key === activeKey;
                  return (
                    <li key={row.key} className={`px-3 py-2 flex items-center gap-2 text-sm ${isActive ? 'bg-secondary/40' : ''}`}>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        row.isOpponent ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' : 'bg-primary/15 text-primary'
                      }`}>{row.isOpponent ? 'Opp' : 'Us'}</span>
                      <span className="font-semibold truncate flex-1 min-w-0">{row.name}</span>
                      <span className="font-bold tabular-nums shrink-0">{row.pitches}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0 w-16 text-right">{row.ks}K/{row.bbs}BB</span>
                      <span className="text-primary font-semibold tabular-nums shrink-0 w-12 text-right">{row.pct}%</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Pinned action buttons */}
      <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => logPitch('ball')} disabled={!canLog}
            style={{ touchAction: 'manipulation' }}
            className="h-14 rounded-2xl bg-secondary text-foreground text-base font-bold active:scale-95 transition-transform disabled:opacity-40 border border-border shadow">
            Ball
          </button>
          <button type="button" onClick={() => logPitch('strike')} disabled={!canLog}
            style={{ touchAction: 'manipulation' }}
            className="h-14 rounded-2xl bg-primary text-primary-foreground text-base font-bold active:scale-95 transition-transform disabled:opacity-40 shadow-lg">
            Strike
          </button>
          <button type="button" onClick={() => logPitch('foul')} disabled={!canLog}
            style={{ touchAction: 'manipulation' }}
            className="h-14 rounded-2xl bg-secondary text-foreground text-base font-bold active:scale-95 transition-transform disabled:opacity-40 border border-border shadow">
            Foul
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => logPitch('in_play_safe')} disabled={!canLog}
            style={{ touchAction: 'manipulation' }}
            className="h-12 rounded-2xl bg-secondary text-foreground text-sm font-bold active:scale-95 transition-transform disabled:opacity-40 border border-border shadow">
            In Play – Safe
          </button>
          <button type="button" onClick={() => logPitch('in_play_out')} disabled={!canLog}
            style={{ touchAction: 'manipulation' }}
            className="h-12 rounded-2xl bg-secondary text-foreground text-sm font-bold active:scale-95 transition-transform disabled:opacity-40 border border-border shadow">
            In Play – Out
          </button>
        </div>
        <button type="button" onClick={() => logPitch('ab_end')} disabled={!canLog}
          style={{ touchAction: 'manipulation' }}
          className="w-full h-11 rounded-2xl bg-accent text-accent-foreground text-sm font-bold active:scale-95 transition-transform disabled:opacity-40 border border-border shadow">
          Next Batter →
        </button>
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={undoLast} disabled={pitches.length === 0}>
            <Undo2 className="w-4 h-4 mr-1" /> Undo
          </Button>
          <div className="text-xs text-muted-foreground">
            Total: <span className="font-bold text-foreground">{totals.total}</span>
            {' · '}<span className="text-primary font-bold">{totals.pct}% K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
