import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
  pitcher_id: string;
  pitcher_name: string;
  inning: number;
  is_strike: boolean;
  sequence: number;
}

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
  const [activePitcherId, setActivePitcherId] = useState<string>('');
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
        setActivePitcherId(rows[rows.length - 1].pitcher_id);
        setCurrentInning(rows[rows.length - 1].inning);
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
    if (!game || !activePitcherId) return;
    const pitcher = pitchers.find(p => p.id === activePitcherId);
    if (!pitcher) return;
    const sequence = pitches.length + 1;
    const optimistic: PitchRow = {
      id: `tmp-${sequence}`,
      pitcher_id: pitcher.id,
      pitcher_name: pitcher.name,
      inning: currentInning,
      is_strike: isStrike,
      sequence,
    };
    setPitches(prev => [...prev, optimistic]);
    const { data, error } = await supabase
      .from('game_pitches')
      .insert({
        game_id: game.id,
        pitcher_id: pitcher.id,
        pitcher_name: pitcher.name,
        inning: currentInning,
        is_strike: isStrike,
        sequence,
        team_id: game.team_id,
        user_id: game.user_id,
      })
      .select()
      .single();
    if (error) {
      setPitches(prev => prev.filter(p => p.id !== optimistic.id));
      toast({ title: 'Pitch not saved', description: error.message, variant: 'destructive' });
      return;
    }
    setPitches(prev => prev.map(p => (p.id === optimistic.id ? (data as PitchRow) : p)));
  }, [game, activePitcherId, pitchers, pitches.length, currentInning, toast]);

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
      // Aggregate per-pitcher
      const byPitcher = new Map<string, { name: string; pitches: number; strikes: number }>();
      pitches.forEach(p => {
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

  const activePitcher = pitchers.find(p => p.id === activePitcherId);
  const activePitcherStats = useMemo(() => {
    if (!activePitcherId) return null;
    const list = pitches.filter(p => p.pitcher_id === activePitcherId);
    const inningList = list.filter(p => p.inning === currentInning);
    const strikes = list.filter(p => p.is_strike).length;
    return {
      total: list.length,
      strikes,
      pct: list.length ? Math.round((strikes / list.length) * 100) : 0,
      inningCount: inningList.length,
    };
  }, [pitches, activePitcherId, currentInning]);

  // ---- Setup screen ----
  if (!game) {
    return (
      <div className="min-h-screen bg-background p-4">
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/games')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Games
        </Button>
        <div className="text-center flex-1">
          <p className="text-xs text-muted-foreground">{game.date}</p>
          <p className="font-semibold">{game.opponent_name || 'Game'}</p>
        </div>
        <Button size="sm" onClick={finishGame} disabled={busy || pitches.length === 0}>
          <Check className="w-4 h-4 mr-1" /> Finish
        </Button>
      </div>

      {/* Pitcher + inning selectors */}
      <div className="p-4 space-y-3 border-b border-border">
        <div>
          <Label className="text-xs">Pitcher</Label>
          <Select value={activePitcherId} onValueChange={setActivePitcherId}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select pitcher" />
            </SelectTrigger>
            <SelectContent>
              {pitchers.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
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

      {/* Active pitcher mini stats */}
      {activePitcher && (
        <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center border-b border-border bg-secondary/30">
          <div>
            <p className="text-2xl font-bold">{activePitcherStats?.total ?? 0}</p>
            <p className="text-[11px] text-muted-foreground uppercase">{activePitcher.name} pitches</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{activePitcherStats?.pct ?? 0}%</p>
            <p className="text-[11px] text-muted-foreground uppercase">Strike %</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{activePitcherStats?.inningCount ?? 0}</p>
            <p className="text-[11px] text-muted-foreground uppercase">Inn {currentInning}</p>
          </div>
        </div>
      )}

      {/* Big tap buttons */}
      <div className="flex-1 flex flex-col p-4 gap-3">
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-[300px]">
          <button
            type="button"
            onClick={() => logPitch(true)}
            disabled={!activePitcherId}
            className="rounded-2xl bg-primary text-primary-foreground text-4xl font-bold active:scale-95 transition-transform disabled:opacity-40 shadow-lg"
          >
            STRIKE
          </button>
          <button
            type="button"
            onClick={() => logPitch(false)}
            disabled={!activePitcherId}
            className="rounded-2xl bg-secondary text-foreground text-4xl font-bold active:scale-95 transition-transform disabled:opacity-40 shadow-lg border border-border"
          >
            BALL
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={undoLast} disabled={pitches.length === 0}>
            <Undo2 className="w-4 h-4 mr-1" /> Undo
          </Button>
          <div className="text-sm text-muted-foreground">
            Total: <span className="font-bold text-foreground">{totals.total}</span> ·
            {' '}<span className="text-primary font-bold">{totals.pct}% K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
