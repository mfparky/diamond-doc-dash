import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { usePageMeta } from '@/hooks/use-page-meta';
import { useToast } from '@/hooks/use-toast';

interface GameRow {
  id: string;
  date: string;
  opponent_name: string | null;
  status: string;
}

interface PitchRow {
  id: string;
  pitcher_id: string;
  pitcher_name: string;
  inning: number;
  is_strike: boolean;
  sequence: number;
}

export default function GamesPage() {
  const { gameId } = useParams<{ gameId?: string }>();
  return gameId ? <GameReview gameId={gameId} /> : <GamesList />;
}

function GamesList() {
  usePageMeta({ title: 'Games | Arm Stats', description: 'Game history with pitch-by-pitch review.' });
  const navigate = useNavigate();
  const { toast } = useToast();
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this game and its pitches?')) return;
    await supabase.from('game_pitches').delete().eq('game_id', id);
    const { error } = await supabase.from('games').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setGames(prev => prev.filter(g => g.id !== id));
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Home
          </Button>
          <h1 className="font-display text-xl font-bold">Games</h1>
          <Button size="sm" onClick={() => navigate('/game')}>
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : games.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="mb-4">No games yet.</p>
              <Button onClick={() => navigate('/game')}>
                <Plus className="w-4 h-4 mr-1" /> Start a Game
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
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(g.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GameReview({ gameId }: { gameId: string }) {
  usePageMeta({ title: 'Game Review | Arm Stats', description: 'Per-pitcher and per-inning game breakdown.' });
  const navigate = useNavigate();
  const [game, setGame] = useState<GameRow | null>(null);
  const [pitches, setPitches] = useState<PitchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: g }, { data: ps }] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).maybeSingle(),
        supabase.from('game_pitches').select('*').eq('game_id', gameId).order('sequence'),
      ]);
      if (cancelled) return;
      setGame(g as GameRow);
      setPitches((ps || []) as PitchRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [gameId]);

  const stats = useMemo(() => {
    const total = pitches.length;
    const strikes = pitches.filter(p => p.is_strike).length;
    const pct = total ? Math.round((strikes / total) * 100) : 0;

    // per pitcher
    const byPitcher = new Map<string, { name: string; pitches: number; strikes: number }>();
    pitches.forEach(p => {
      const cur = byPitcher.get(p.pitcher_id) || { name: p.pitcher_name, pitches: 0, strikes: 0 };
      cur.pitches += 1;
      if (p.is_strike) cur.strikes += 1;
      byPitcher.set(p.pitcher_id, cur);
    });
    const pitchers = Array.from(byPitcher.entries())
      .map(([id, v]) => ({
        id,
        name: v.name,
        pitches: v.pitches,
        strikes: v.strikes,
        pct: v.pitches ? Math.round((v.strikes / v.pitches) * 100) : 0,
        share: total ? Math.round((v.pitches / total) * 100) : 0,
      }))
      .sort((a, b) => b.pitches - a.pitches);

    // per inning
    const byInning = new Map<number, { pitches: number; strikes: number }>();
    pitches.forEach(p => {
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

    return { total, strikes, pct, pitchers, innings };
  }, [pitches]);

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
              Resume
            </Button>
          )}
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold">{game.opponent_name || 'Game'}</h1>
          <p className="text-sm text-muted-foreground">{game.date}</p>
        </div>

        {/* Team totals */}
        <div className="grid grid-cols-3 gap-2">
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
        </div>

        {/* Per pitcher */}
        <Card>
          <CardHeader><CardTitle className="text-base">By Pitcher</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.pitchers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pitches logged.</p>
            ) : stats.pitchers.map(p => (
              <div key={p.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-sm text-muted-foreground">{p.share}% of game</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div><span className="font-bold text-base">{p.pitches}</span><p className="text-xs text-muted-foreground">Pitches</p></div>
                  <div><span className="font-bold text-base text-primary">{p.pct}%</span><p className="text-xs text-muted-foreground">Strike %</p></div>
                  <div><span className="font-bold text-base">{p.strikes}/{p.pitches - p.strikes}</span><p className="text-xs text-muted-foreground">K / B</p></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Per inning */}
        <Card>
          <CardHeader><CardTitle className="text-base">By Inning</CardTitle></CardHeader>
          <CardContent>
            {stats.innings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No innings yet.</p>
            ) : (
              <div className="space-y-1">
                {stats.innings.map(i => (
                  <div key={i.inning} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="font-bold w-12">Inn {i.inning}</span>
                    <span className="flex-1 text-center text-muted-foreground text-sm">{i.pitches} pitches</span>
                    <span className="text-primary font-semibold w-16 text-right">{i.pct}% K</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
