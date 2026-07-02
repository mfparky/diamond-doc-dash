import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowUp, ArrowDown, Wand2, Save, CheckCircle2 } from 'lucide-react';
import { usePitchers } from '@/hooks/use-pitchers';
import { useAllStatSnapshots } from '@/hooks/use-stat-snapshots';
import { useLineup } from '@/hooks/use-lineup';
import { buildBattingOrder, applyManualOrder, type LineupCandidate, type BattingOrderSpot } from '@/lib/lineup-builder';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function LineupPage() {
  const { toast } = useToast();
  const { pitchers, isLoading: pitchersLoading } = usePitchers();
  const pitcherIds = useMemo(() => pitchers.map((p) => p.id), [pitchers]);
  const { byPitcher, isLoading: snapshotsLoading } = useAllStatSnapshots(pitcherIds);

  const [date, setDate] = useState<string>(todayIso());
  const { lineup, isLoading: lineupLoading, save } = useLineup(date);
  const [available, setAvailable] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<BattingOrderSpot[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);

  // Build candidate map keyed by pitcherId.
  const candidateById = useMemo(() => {
    const m = new Map<string, LineupCandidate>();
    for (const p of pitchers) {
      m.set(p.id, {
        pitcherId: p.id,
        pitcherName: p.name,
        stats: byPitcher.get(p.id)?.[0]?.stats ?? null,
      });
    }
    return m;
  }, [pitchers, byPitcher]);

  // When loaded from Supabase, hydrate available + order state.
  useEffect(() => {
    if (!lineup) return;
    const savedIds = lineup.battingOrder.filter((id) => candidateById.has(id));
    if (savedIds.length === 0) return;
    setAvailable(new Set(savedIds));
    setOrder(applyManualOrder(savedIds.map((id) => candidateById.get(id)!)));
  }, [lineup, candidateById]);

  // Default 'available' = everyone on the roster (the first time this loads
  // for a date with no saved lineup).
  useEffect(() => {
    if (lineup) return;
    if (available.size > 0) return;
    if (pitchers.length === 0) return;
    setAvailable(new Set(pitchers.map((p) => p.id)));
  }, [pitchers, lineup, available.size]);

  const generate = () => {
    const candidates = Array.from(available)
      .map((id) => candidateById.get(id))
      .filter((c): c is LineupCandidate => !!c);
    const next = buildBattingOrder(candidates);
    setOrder(next);
    toast({
      title: 'Lineup generated',
      description: `${next.length} slots filled from ${candidates.length} available players.`,
    });
  };

  const moveSpot = (index: number, delta: -1 | 1) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    // Re-derive archetypes/rationales for the new positions.
    const orderedCandidates = next.map((spot) => candidateById.get(spot.candidateId)!).filter(Boolean);
    setOrder(applyManualOrder(orderedCandidates));
  };

  const togglePlayer = (id: string) => {
    const next = new Set(available);
    if (next.has(id)) {
      next.delete(id);
      // Also drop from order if present.
      if (order.some((s) => s.candidateId === id)) {
        const rebuilt = order
          .filter((s) => s.candidateId !== id)
          .map((s) => candidateById.get(s.candidateId)!)
          .filter(Boolean);
        setOrder(applyManualOrder(rebuilt));
      }
    } else {
      next.add(id);
    }
    setAvailable(next);
  };

  const handleSave = async () => {
    const ok = await save(order.map((s) => s.candidateId), null);
    if (ok) {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    }
  };

  const isLoading = pitchersLoading || snapshotsLoading || lineupLoading;
  const rosterSorted = useMemo(
    () => [...pitchers].sort((a, b) => a.name.localeCompare(b.name)),
    [pitchers],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-6 max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back to dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground">
              Lineup Planner
            </h1>
            <p className="text-sm text-muted-foreground">
              Pick who's playing today, then auto-generate a batting order from each player's latest stat snapshot. Drag / arrow to override.
            </p>
          </div>
        </div>

        {/* Date + Save */}
        <Card className="glass-card">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="lineup-date" className="text-sm font-medium">
                Game date
              </Label>
              <Input
                id="lineup-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
              <Button variant="outline" onClick={generate} className="gap-1.5">
                <Wand2 className="w-4 h-4" />
                Generate order
              </Button>
              <Button
                onClick={handleSave}
                disabled={order.length === 0}
                className="gap-1.5"
              >
                {savedFlash ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {savedFlash ? 'Saved' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <Card className="glass-card">
            <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
          </Card>
        )}

        {!isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Available players (checklist) */}
            <Card className="glass-card lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">Who's playing?</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {available.size} of {pitchers.length} selected.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {rosterSorted.map((p) => {
                  const checked = available.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/40 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePlayer(p.id)}
                        aria-label={p.name}
                      />
                      <span className="text-sm text-foreground flex-1">{p.name}</span>
                    </label>
                  );
                })}
              </CardContent>
            </Card>

            {/* Batting order */}
            <Card className="glass-card lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  Batting order
                  {order.length > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">
                      {order.length} slot{order.length === 1 ? '' : 's'}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center space-y-2">
                    <p>No lineup generated yet.</p>
                    <p className="text-xs">
                      Pick the players who are playing today, then hit <span className="font-semibold text-foreground">Generate order</span>.
                    </p>
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {order.map((spot, idx) => (
                      <li
                        key={spot.candidateId}
                        className={cn(
                          'rounded-md border border-border/60 bg-secondary/30 p-3 flex items-start gap-3',
                        )}
                      >
                        <span className="text-lg font-black text-primary tabular-nums w-6 shrink-0">
                          {spot.order}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {spot.candidateName}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
                              {spot.driver.label}
                              {spot.driver.value !== null && (
                                <span className="ml-1 text-foreground">
                                  {spot.driver.key.includes('per_pa')
                                    ? spot.driver.value.toFixed(3)
                                    : spot.driver.value.toFixed(3)}
                                </span>
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                            {spot.rationale}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Move up"
                            disabled={idx === 0}
                            onClick={() => moveSpot(idx, -1)}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Move down"
                            disabled={idx === order.length - 1}
                            onClick={() => moveSpot(idx, 1)}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
