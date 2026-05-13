import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { usePitchers } from '@/hooks/use-pitchers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Undo2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { usePageMeta } from '@/hooks/use-page-meta';

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
}

type Side = 'us' | 'opp';

const OPP_KEY_PREFIX = 'opp:';
const opponentLabel = (jersey: string) => `Opp #${jersey}`;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function GameModePage() {
  usePageMeta({ title: 'Game Mode | Arm Stats', description: 'Live pitch-by-pitch counter for games.' });
  const { gameId: paramGameId } = useParams<{ gameId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pitchers, isLoading: pitchersLoading } = usePitchers();

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

  // Load existing game if id in url
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
      // inherit team_id from any pitcher (they all share one team in this MVP)
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
    } catch (e: any) {
      toast({ title: 'Could not start game', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }, [date, opponent, pitchers, navigate, toast]);

  const logPitch = useCallback(async (isStrike: boolean) => {
    if (!game) return;

    let optimistic: PitchRow;
    let insertPayload: TablesInsert<'game_pitches'>;
    const sequence = pitches.length + 1;

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
      // Aggregate per-pitcher — only OUR pitchers feed Arm Tracker outings.
      const byPitcher = new Map<string, { name: string; pitches: number; strikes: number }>();
      pitches.forEach(p => {
        if (p.is_opponent || !p.pitcher_id) return;
        const cur = byPitcher.get(p.pitcher_id) || { name: p.pitcher_name, pitches: 0, strikes: 0 };
        cur.pitches += 1;
        if (p.is_strike) cur.strikes += 1;
        byPitcher.set(p.pitcher_id, cur);
      });

      // Create one outing per pitcher (feeds Arm Tracker)
      const { data: { user } } = await supabase.auth.getUser();
      const outingRows = Array.from(byPitcher.entries()).map(([pid, agg]) => ({
        pitcher_id: pid,
        pitcher_name: agg.name,
        date: game.date,
        event_type: 'Game',
        pitch_count: agg.pitches,
        strikes: agg.strikes,
        max_velocity: 0,
        notes: game.opponent_name ? `Game vs ${game.opponent_name}` : 'Game',
        team_id: game.team_id,
        user_id: user?.id ?? game.user_id,
      }));
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
    } catch (e: any) {
      toast({ title: 'Could not finish game', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }, [game, pitches, navigate, toast]);

  // Stats
  const totals = useMemo(() => {
    const total = pitches.length;
    const strikes = pitches.filter(p => p.is_strike).length;
    return { total, strikes, balls: total - strikes, pct: total ? Math.round((strikes / total) * 100) : 0 };
  }, [pitches]);

  // Active subject — either our pitcher or an opponent jersey
  const activeKey = side === 'us'
    ? activePitcherId
    : (oppJersey.trim() ? `${OPP_KEY_PREFIX}${oppJersey.trim()}` : '');

  const activeSubjectLabel = side === 'us'
    ? (pitchers.find(p => p.id === activePitcherId)?.name ?? '')
    : (oppJersey.trim() ? opponentLabel(oppJersey.trim()) : '');

  const activeStats = useMemo(() => {
    if (!activeKey) return null;
    const matches = pitches.filter(p => {
      if (side === 'us') return !p.is_opponent && p.pitcher_id === activePitcherId;
      return p.is_opponent && p.opponent_jersey === oppJersey.trim();
    });
    const strikes = matches.filter(p => p.is_strike).length;
    const inningCount = matches.filter(p => p.inning === currentInning).length;
    return {
      total: matches.length,
      strikes,
      pct: matches.length ? Math.round((strikes / matches.length) * 100) : 0,
      inningCount,
    };
  }, [pitches, side, activePitcherId, oppJersey, activeKey, currentInning]);

  // Tally — grouped per pitcher, both teams
  const tally = useMemo(() => {
    type Row = { key: string; name: string; isOpponent: boolean; pitches: number; strikes: number };
    const map = new Map<string, Row>();
    pitches.forEach(p => {
      const key = p.is_opponent
        ? `${OPP_KEY_PREFIX}${p.opponent_jersey ?? ''}`
        : (p.pitcher_id ?? p.pitcher_name);
      const cur = map.get(key) || { key, name: p.pitcher_name, isOpponent: p.is_opponent, pitches: 0, strikes: 0 };
      cur.pitches += 1;
      if (p.is_strike) cur.strikes += 1;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map(r => ({ ...r, pct: r.pitches ? Math.round((r.strikes / r.pitches) * 100) : 0 }))
      .sort((a, b) => Number(a.isOpponent) - Number(b.isOpponent) || b.pitches - a.pitches);
  }, [pitches]);

  const canLog = side === 'us' ? !!activePitcherId : !!oppJersey.trim();

  // ---- Setup screen ----
  if (!game) {
    return (
      <div className="min-h-screen bg-background p-4 overflow-x-hidden">
        <div className="max-w-md mx-auto">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Start a Game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Opponent (optional)</Label>
                <Input value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="e.g. Markham Mariners" />
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

  // ---- Active game screen ----
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-card flex items-center gap-2">
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

      {/* Side toggle */}
      <div className="px-3 pt-3">
        <div className="grid grid-cols-2 rounded-lg bg-secondary p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setSide('us')}
            className={`h-9 rounded-md transition-colors ${side === 'us' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            Our Pitcher
          </button>
          <button
            type="button"
            onClick={() => setSide('opp')}
            className={`h-9 rounded-md transition-colors ${side === 'opp' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            Opponent
          </button>
        </div>
      </div>

      {/* Pitcher + inning selectors */}
      <div className="p-3 space-y-3 border-b border-border">
        {side === 'us' ? (
          <div className="min-w-0">
            <Label className="text-xs">Pitcher</Label>
            <Select value={activePitcherId} onValueChange={setActivePitcherId}>
              <SelectTrigger className="h-12 w-full">
                <SelectValue placeholder="Select pitcher" />
              </SelectTrigger>
              <SelectContent>
                {pitchers.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="min-w-0">
            <Label className="text-xs">Opponent jersey #</Label>
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              value={oppJersey}
              onChange={e => setOppJersey(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 12"
              className="h-12 text-lg w-full"
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Inning</Label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setCurrentInning(i => Math.max(1, i - 1))}>
              <ChevronDown className="w-4 h-4" />
            </Button>
            <span className="text-2xl font-bold w-10 text-center">{currentInning}</span>
            <Button variant="outline" size="icon" onClick={() => setCurrentInning(i => i + 1)}>
              <ChevronUp className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active subject mini stats */}
      {activeSubjectLabel && (
        <div className="px-3 py-3 grid grid-cols-3 gap-2 text-center border-b border-border bg-secondary/30">
          <div className="min-w-0">
            <p className="text-2xl font-bold">{activeStats?.total ?? 0}</p>
            <p className="text-[11px] text-muted-foreground uppercase truncate">{activeSubjectLabel}</p>
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-primary">{activeStats?.pct ?? 0}%</p>
            <p className="text-[11px] text-muted-foreground uppercase">Strike %</p>
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold">{activeStats?.inningCount ?? 0}</p>
            <p className="text-[11px] text-muted-foreground uppercase">Inn {currentInning}</p>
          </div>
        </div>
      )}

      {/* Big tap buttons */}
      <div className="flex flex-col p-3 gap-3">
        <div className="grid grid-cols-2 gap-3 min-h-[200px] sm:min-h-[260px]">
          <button
            type="button"
            onClick={() => logPitch(true)}
            disabled={!canLog}
            className="rounded-2xl bg-primary text-primary-foreground text-3xl sm:text-4xl font-bold active:scale-95 transition-transform disabled:opacity-40 shadow-lg"
          >
            STRIKE
          </button>
          <button
            type="button"
            onClick={() => logPitch(false)}
            disabled={!canLog}
            className="rounded-2xl bg-secondary text-foreground text-3xl sm:text-4xl font-bold active:scale-95 transition-transform disabled:opacity-40 shadow-lg border border-border"
          >
            BALL
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button variant="outline" onClick={undoLast} disabled={pitches.length === 0}>
            <Undo2 className="w-4 h-4 mr-1" /> Undo
          </Button>
          <div className="text-sm text-muted-foreground">
            Total: <span className="font-bold text-foreground">{totals.total}</span>
            {' · '}<span className="text-primary font-bold">{totals.pct}% K</span>
          </div>
        </div>
      </div>

      {/* All-pitchers tally */}
      <div className="px-3 pb-6">
        <div className="rounded-lg border border-border bg-card">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All Pitchers</p>
            <p className="text-[11px] text-muted-foreground">{tally.length} tracked</p>
          </div>
          {tally.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              No pitches logged yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {tally.map(row => {
                const isActive = row.key === activeKey;
                return (
                  <li
                    key={row.key}
                    className={`px-3 py-2 flex items-center gap-2 text-sm ${isActive ? 'bg-secondary/40' : ''}`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        row.isOpponent
                          ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
                          : 'bg-primary/15 text-primary'
                      }`}
                    >
                      {row.isOpponent ? 'Opp' : 'Us'}
                    </span>
                    <span className="font-semibold truncate flex-1 min-w-0">{row.name}</span>
                    <span className="font-bold tabular-nums shrink-0">{row.pitches}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0 w-14 text-right">
                      {row.strikes}/{row.pitches - row.strikes}
                    </span>
                    <span className="text-primary font-semibold tabular-nums shrink-0 w-12 text-right">
                      {row.pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
