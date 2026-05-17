import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Trash2, Radio } from 'lucide-react';
import { usePageMeta } from '@/hooks/use-page-meta';
import { useToast } from '@/hooks/use-toast';
import { usePitchers } from '@/hooks/use-pitchers';

interface GameRow {
  id: string;
  date: string;
  opponent_name: string | null;
  status: string;
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

interface OutingRow {
  id: string;
  pitcher_name: string;
  event_type: string;
  pitch_count: number;
  strikes: number | null;
  max_velocity: number | null;
  notes: string | null;
  focus: string | null;
  coach_notes: string | null;
  game_id: string | null;
  date: string;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function GamesPage() {
  const { gameId } = useParams<{ gameId?: string }>();
  return gameId ? <GameReview gameId={gameId} /> : <GamesList />;
}

function GamesList() {
  usePageMeta({ title: 'Games | Arm Stats', description: 'Post-game review of pitch totals, strike % and per-pitcher splits.' });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pitchers } = usePitchers();
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [opponent, setOpponent] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('games')
      .select('id, date, opponent_name, status')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    setGames((data || []) as GameRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const [pendingDelete, setPendingDelete] = useState<GameRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await supabase.from('game_pitches').delete().eq('game_id', pendingDelete.id);
      const { error } = await supabase.from('games').delete().eq('id', pendingDelete.id);
      if (error) {
        toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
        return;
      }
      setGames(prev => prev.filter(g => g.id !== pendingDelete.id));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const createGame = useCallback(async () => {
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
          status: 'completed',
          user_id: user.id,
          team_id: teamId,
        })
        .select()
        .single();
      if (error) throw error;
      setCreating(false);
      navigate(`/games/${data.id}`);
    } catch (e: any) {
      toast({ title: 'Could not create game', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }, [date, opponent, pitchers, navigate, toast]);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Home
          </Button>
          <h1 className="font-display text-xl font-bold">Games</h1>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Each game pulls in every outing logged on that date — live charting, post-session entries, paper-form scans — and rolls them up.
        </p>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : games.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="mb-4">No games yet.</p>
              <Button onClick={() => setCreating(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add a Game
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {games.map(g => (
              <Card key={g.id} className="hover:bg-secondary/30 transition-colors">
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <Link to={`/games/${g.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {g.opponent_name || 'Game'}
                        </p>
                        <p className="text-xs text-muted-foreground">{g.date}</p>
                      </div>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${g.status === 'completed' ? 'bg-primary/15 text-primary' : 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'}`}>
                        {g.status === 'completed' ? 'Final' : 'Live'}
                      </span>
                    </div>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => setPendingDelete(g)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-border">
          <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/game')}>
            <Radio className="w-4 h-4 mr-2" /> Open live ball/strike counter
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Optional dugout tool for tap-by-tap counting.
          </p>
        </div>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a Game</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Opponent (optional)</Label>
              <Input value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="e.g. Markham Mariners" />
            </div>
            <p className="text-xs text-muted-foreground">
              The review will pull in any outing already logged for {date} and let you add more from the outing form.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={createGame} disabled={busy}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this game?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes "{pendingDelete?.opponent_name || 'Game'}" on {pendingDelete?.date} and its live pitch log.
              Outings already saved on the same date are NOT deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GameReview({ gameId }: { gameId: string }) {
  usePageMeta({ title: 'Game Review | Arm Stats', description: 'Per-pitcher game breakdown, strike %, and totals from all outings on the game date.' });
  const navigate = useNavigate();
  const [game, setGame] = useState<GameRow | null>(null);
  const [pitches, setPitches] = useState<PitchRow[]>([]);
  const [outings, setOutings] = useState<OutingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [linking, setLinking] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reload = useCallback(async () => {
    const { data: g } = await supabase.from('games').select('*').eq('id', gameId).maybeSingle();
    const { data: ps } = await supabase.from('game_pitches').select('*').eq('game_id', gameId).order('sequence');
    let outs: OutingRow[] = [];
    if (g?.date) {
      // Pull outings that are EITHER linked to this game OR on the same date (so coach can attach them).
      const { data: os } = await supabase
        .from('outings')
        .select('id, pitcher_name, event_type, pitch_count, strikes, max_velocity, notes, focus, coach_notes, game_id, date')
        .or(`game_id.eq.${gameId},date.eq.${g.date}`);
      outs = (os || []) as OutingRow[];
    }
    setGame(g as GameRow);
    setPitches((ps || []) as PitchRow[]);
    setOutings(outs);
    setLoading(false);
  }, [gameId]);

  useEffect(() => { reload(); }, [reload]);

  // Outings actually counted toward this game = explicitly linked via game_id.
  const linkedOutings = useMemo(() => outings.filter(o => o.game_id === gameId), [outings, gameId]);
  // Same-date outings that aren't linked to this game (candidates to attach).
  const availableOutings = useMemo(
    () => outings.filter(o => o.game_id !== gameId && o.date === game?.date),
    [outings, gameId, game?.date]
  );

  const stats = useMemo(() => {
    // Game outings = explicitly linked outings of event_type 'Game'.
    const gameOutings = linkedOutings.filter(o => o.event_type === 'Game');

    type P = { key: string; name: string; pitches: number; strikes: number; maxVelo: number; focus: string | null; coachNotes: string | null; source: 'outing' | 'live' };
    const pitcherMap = new Map<string, P>();

    gameOutings.forEach(o => {
      const k = o.pitcher_name.toLowerCase();
      const cur = pitcherMap.get(k) || { key: k, name: o.pitcher_name, pitches: 0, strikes: 0, maxVelo: 0, focus: null, coachNotes: null, source: 'outing' as const };
      cur.pitches += o.pitch_count || 0;
      cur.strikes += o.strikes || 0;
      cur.maxVelo = Math.max(cur.maxVelo, o.max_velocity || 0);
      cur.focus = cur.focus || o.focus;
      cur.coachNotes = cur.coachNotes || o.coach_notes;
      pitcherMap.set(k, cur);
    });

    // Live game_pitches — only fold our own pitchers in (skip opponents).
    // Opponent jerseys are tallied separately below.
    const ourPitches = pitches.filter(p => !p.is_opponent);
    const liveByPitcher = new Map<string, { name: string; pitches: number; strikes: number }>();
    ourPitches.forEach(p => {
      const k = p.pitcher_name.toLowerCase();
      const cur = liveByPitcher.get(k) || { name: p.pitcher_name, pitches: 0, strikes: 0 };
      cur.pitches += 1;
      if (p.is_strike) cur.strikes += 1;
      liveByPitcher.set(k, cur);
    });
    liveByPitcher.forEach((v, k) => {
      if (!pitcherMap.has(k)) {
        pitcherMap.set(k, { key: k, name: v.name, pitches: v.pitches, strikes: v.strikes, maxVelo: 0, focus: null, coachNotes: null, source: 'live' });
      }
    });

    // Pull non-game-day notes (Bullpen, Practice, etc.) from linked outings for richer context
    const otherOutingByName = new Map<string, OutingRow[]>();
    linkedOutings.filter(o => o.event_type !== 'Game').forEach(o => {
      const k = o.pitcher_name.toLowerCase();
      const arr = otherOutingByName.get(k) || [];
      arr.push(o);
      otherOutingByName.set(k, arr);
    });
    pitcherMap.forEach(p => {
      const others = otherOutingByName.get(p.key) || [];
      others.forEach(o => {
        if (o.max_velocity) p.maxVelo = Math.max(p.maxVelo, o.max_velocity);
        if (!p.focus && o.focus) p.focus = o.focus;
        if (!p.coachNotes && o.coach_notes) p.coachNotes = o.coach_notes;
      });
    });

    let total = 0, strikes = 0;
    pitcherMap.forEach(p => { total += p.pitches; strikes += p.strikes; });

    const pitchers = Array.from(pitcherMap.values())
      .map(p => ({
        ...p,
        pct: p.pitches ? Math.round((p.strikes / p.pitches) * 100) : 0,
        share: total ? Math.round((p.pitches / total) * 100) : 0,
        maxVelo: p.maxVelo || null,
      }))
      .sort((a, b) => b.pitches - a.pitches);

    const teamMaxVelo = pitchers.reduce((m, p) => Math.max(m, p.maxVelo || 0), 0) || null;
    const pct = total ? Math.round((strikes / total) * 100) : 0;

    // Per inning — only available from live pitch_by_pitch tool (our pitches only)
    const byInning = new Map<number, { pitches: number; strikes: number }>();
    ourPitches.forEach(p => {
      const cur = byInning.get(p.inning) || { pitches: 0, strikes: 0 };
      cur.pitches += 1;
      if (p.is_strike) cur.strikes += 1;
      byInning.set(p.inning, cur);
    });
    const innings = Array.from(byInning.entries())
      .map(([inn, v]) => ({
        inning: inn,
        pitches: v.pitches,
        strikes: v.strikes,
        pct: v.pitches ? Math.round((v.strikes / v.pitches) * 100) : 0,
      }))
      .sort((a, b) => a.inning - b.inning);

    // Opponent pitchers — tallied from live counter only, kept separate from our stats.
    const oppMap = new Map<string, { jersey: string; pitches: number; strikes: number }>();
    pitches.filter(p => p.is_opponent).forEach(p => {
      const jersey = p.opponent_jersey || '?';
      const cur = oppMap.get(jersey) || { jersey, pitches: 0, strikes: 0 };
      cur.pitches += 1;
      if (p.is_strike) cur.strikes += 1;
      oppMap.set(jersey, cur);
    });
    const opponents = Array.from(oppMap.values())
      .map(o => ({ ...o, pct: o.pitches ? Math.round((o.strikes / o.pitches) * 100) : 0 }))
      .sort((a, b) => b.pitches - a.pitches);

    const oppTotal = opponents.reduce((s, o) => s + o.pitches, 0);
    const oppStrikes = opponents.reduce((s, o) => s + o.strikes, 0);
    const oppPct = oppTotal ? Math.round((oppStrikes / oppTotal) * 100) : 0;

    return { total, strikes, pct, pitchers, innings, teamMaxVelo, gameOutingCount: gameOutings.length, opponents, oppTotal, oppStrikes, oppPct };
  }, [pitches, linkedOutings]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!game) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Game not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/games')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Games
          </Button>
          {game.status !== 'completed' && (
            <Button size="sm" onClick={() => navigate(`/game/${game.id}`)}>
              Resume live
            </Button>
          )}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">{game.opponent_name || 'Game'}</h1>
            <p className="text-sm text-muted-foreground">{game.date}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            Outings ({linkedOutings.length}{availableOutings.length > 0 ? ` · +${availableOutings.length} avail` : ''})
          </Button>
        </div>

        {stats.total === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-sm text-muted-foreground space-y-2">
              <p>No outings attached to this game yet.</p>
              {availableOutings.length > 0 ? (
                <p>{availableOutings.length} outing{availableOutings.length === 1 ? '' : 's'} logged on {game.date} can be attached — tap "Outings" above.</p>
              ) : (
                <p>Log a Game outing (Live Charting, Post-Session, or paper-form scan) for {game.date} and attach it here.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Our team totals */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-primary">Our Team</h2>
            {linkedOutings.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {stats.gameOutingCount} game outing{stats.gameOutingCount === 1 ? '' : 's'}
                {linkedOutings.length - stats.gameOutingCount > 0 && ` · +${linkedOutings.length - stats.gameOutingCount} other`}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Card><CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground uppercase">Total Pitches</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary">{stats.pct}%</p>
              <p className="text-xs text-muted-foreground uppercase">Strike %</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{stats.strikes}/{stats.total - stats.strikes}</p>
              <p className="text-xs text-muted-foreground uppercase">K / B</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{stats.teamMaxVelo ? `${stats.teamMaxVelo}` : '—'}</p>
              <p className="text-xs text-muted-foreground uppercase">Top Velo</p>
            </CardContent></Card>
          </div>
        </div>

        {/* Per pitcher (us) */}
        <Card>
          <CardHeader><CardTitle className="text-base">Our Pitchers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.pitchers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pitchers logged.</p>
            ) : stats.pitchers.map(p => (
              <div key={p.key} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-sm text-muted-foreground">{p.share}% of team</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div><span className="font-bold text-base">{p.pitches}</span><p className="text-xs text-muted-foreground">Pitches</p></div>
                  <div><span className="font-bold text-base text-primary">{p.pct}%</span><p className="text-xs text-muted-foreground">Strike %</p></div>
                  <div><span className="font-bold text-base">{p.strikes}/{p.pitches - p.strikes}</span><p className="text-xs text-muted-foreground">K / B</p></div>
                  <div><span className="font-bold text-base">{p.maxVelo ?? '—'}</span><p className="text-xs text-muted-foreground">Max Velo</p></div>
                </div>
                {(p.focus || p.coachNotes) && (
                  <div className="mt-2 pt-2 border-t border-border space-y-1">
                    {p.focus && <p className="text-xs"><span className="text-muted-foreground">Focus: </span>{p.focus}</p>}
                    {p.coachNotes && <p className="text-xs"><span className="text-muted-foreground">Notes: </span>{p.coachNotes}</p>}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Opponent — totals + per-jersey list (live counter only) */}
        {stats.opponents.length > 0 && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-xs font-bold uppercase tracking-wide text-yellow-600 dark:text-yellow-400">Opponent</h2>
                <p className="text-[11px] text-muted-foreground">From live counter</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Card><CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold">{stats.oppTotal}</p>
                  <p className="text-xs text-muted-foreground uppercase">Total Pitches</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{stats.oppPct}%</p>
                  <p className="text-xs text-muted-foreground uppercase">Strike %</p>
                </CardContent></Card>
                <Card><CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold">{stats.oppStrikes}/{stats.oppTotal - stats.oppStrikes}</p>
                  <p className="text-xs text-muted-foreground uppercase">K / B</p>
                </CardContent></Card>
              </div>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Opponent Pitchers</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {stats.opponents.map(o => (
                    <div key={o.jersey} className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-2">
                      <span className="font-bold w-16 shrink-0">#{o.jersey}</span>
                      <span className="flex-1 text-center text-muted-foreground text-sm">{o.pitches} pitches · {o.strikes}/{o.pitches - o.strikes} K/B</span>
                      <span className="text-primary font-semibold w-16 text-right shrink-0">{o.pct}% K</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Per inning — only when live tool was used */}
        {stats.innings.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">By Inning <span className="text-xs font-normal text-muted-foreground">(from live counter)</span></CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {stats.innings.map(i => (
                  <div key={i.inning} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="font-bold w-12">Inn {i.inning}</span>
                    <span className="flex-1 text-center text-muted-foreground text-sm">{i.pitches} pitches</span>
                    <span className="text-primary font-semibold w-16 text-right">{i.pct}% K</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
