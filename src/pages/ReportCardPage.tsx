import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Wand2, Save, Printer, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { usePitchers } from '@/hooks/use-pitchers';
import { useAllStatSnapshots } from '@/hooks/use-stat-snapshots';
import { useReportCard } from '@/hooks/use-report-card';
import {
  generateReportCardDraft,
  ReportCardLLMError,
  type ReportCardInput,
} from '@/lib/report-card-llm';
import { useToast } from '@/hooks/use-toast';
import { getStoredApiKey } from '@/lib/scan-form';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function friendlyDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReportCardPage() {
  const { toast } = useToast();
  const [search, setSearch] = useSearchParams();

  const { pitchers, isLoading: pitchersLoading } = usePitchers();
  const pitcherIds = useMemo(() => pitchers.map((p) => p.id), [pitchers]);
  const { byPitcher, isLoading: snapshotsLoading } = useAllStatSnapshots(pitcherIds);

  const playerId = search.get('playerId') ?? '';
  const initialStart = search.get('start') ?? isoDaysAgo(60);
  const initialEnd = search.get('end') ?? todayIso();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);

  const player = useMemo(() => pitchers.find((p) => p.id === playerId), [pitchers, playerId]);
  const snapshots = useMemo(() => (playerId ? byPitcher.get(playerId) ?? [] : []), [byPitcher, playerId]);
  const latestSnapshot = snapshots[0];
  const previousSnapshot = snapshots[1];

  const { card, isLoading: cardLoading, save } = useReportCard(playerId || undefined, start, end);

  const [context, setContext] = useState('');
  const [summary, setSummary] = useState('');
  const [strengths, setStrengths] = useState('');
  const [areas, setAreas] = useState('');
  const [generating, setGenerating] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Hydrate from the saved card when it loads.
  useEffect(() => {
    if (!card) return;
    setContext(card.coachContext);
    setSummary(card.summary);
    setStrengths(card.strengths);
    setAreas(card.areas);
  }, [card]);

  const hasApiKey = getStoredApiKey().length > 0;

  const handleGenerate = async () => {
    if (!player) return;
    if (!hasApiKey) {
      toast({
        title: 'Anthropic API key needed',
        description: 'Set one from the paper-form scanner. Coaches BYOK for AI drafts.',
        variant: 'destructive',
      });
      return;
    }
    setGenerating(true);
    try {
      const input: ReportCardInput = {
        playerName: player.name,
        periodLabel: `${friendlyDate(start)} — ${friendlyDate(end)}`,
        playerValue: null,
        playerValueRankInTeam: null,
        totalPlayers: null,
        latestStats: latestSnapshot?.stats ?? null,
        previousStats: previousSnapshot?.stats ?? null,
        ratings: {
          effort: player.effortRating,
          coachability: player.coachabilityRating,
          baseballIq: player.baseballIqRating,
        },
        coachContext: context,
      };
      const draft = await generateReportCardDraft(input);
      setSummary(draft.summary);
      setStrengths(draft.strengths);
      setAreas(draft.areas);
      toast({ title: 'Draft ready', description: 'Review and edit the sections before saving.' });
    } catch (e) {
      const msg = e instanceof ReportCardLLMError ? e.message : 'Could not generate the draft. Try again.';
      toast({ title: 'Draft failed', description: msg, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!player) return;
    const ok = await save({
      coachContext: context,
      summary,
      strengths,
      areas,
      snapshotId: latestSnapshot?.id ?? null,
    });
    if (ok) {
      setSavedFlash(true);
      setSearch({ playerId, start, end }, { replace: true });
      window.setTimeout(() => setSavedFlash(false), 1800);
    }
  };

  const handlePrint = () => window.print();

  const isLoading = pitchersLoading || snapshotsLoading || cardLoading;

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="container mx-auto px-3 sm:px-4 py-6 max-w-3xl space-y-6 print:max-w-full print:px-0 print:py-0">
        {/* Header — hidden in print */}
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back to dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground">Report Cards</h1>
            <p className="text-sm text-muted-foreground">
              Coach-driven mid-season reviews. Type context, generate a draft, edit freely, save and print.
            </p>
          </div>
        </div>

        {/* Player picker + period */}
        <Card className="glass-card print:hidden">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rc-player" className="text-xs uppercase tracking-wider text-muted-foreground">Player</Label>
                <select
                  id="rc-player"
                  className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
                  value={playerId}
                  onChange={(e) => setSearch({ playerId: e.target.value, start, end }, { replace: true })}
                >
                  <option value="">Pick a player…</option>
                  {pitchers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rc-start" className="text-xs uppercase tracking-wider text-muted-foreground">Period start</Label>
                <Input id="rc-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rc-end" className="text-xs uppercase tracking-wider text-muted-foreground">Period end</Label>
                <Input id="rc-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>

            {!hasApiKey && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-amber-800 dark:text-amber-200">
                  No Anthropic API key configured. Set one from the paper-form scanner to enable
                  AI-drafted narratives. You can still write and save the sections by hand.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading && (
          <Card className="glass-card print:hidden">
            <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
          </Card>
        )}

        {!isLoading && !player && (
          <Card className="glass-card print:hidden">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Pick a player above to start a report card.
            </CardContent>
          </Card>
        )}

        {!isLoading && player && (
          <>
            {/* Coach context input */}
            <Card className="glass-card print:hidden">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">Coach context</CardTitle>
                <p className="text-xs text-muted-foreground">
                  What do you want the draft to weave in? Anecdotes, specific games, growth
                  moments, focus areas — anything the stats can't tell.
                </p>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={5}
                  placeholder="Owen has been our most vocal leader this year. Struggled with control in June but bounced back after the mechanical adjustment we made…"
                  className="text-sm"
                />
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
                  <Button onClick={handleGenerate} disabled={generating || !hasApiKey}>
                    {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                    Generate draft
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* The report card — visible on screen AND in print */}
            <div className="space-y-4 print:space-y-3">
              <div className="print:mb-4">
                <h2 className="font-display text-2xl font-bold text-foreground">
                  {player.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Report Card · {friendlyDate(start)} — {friendlyDate(end)}
                </p>
              </div>

              <ReportSection
                title="Summary"
                value={summary}
                onChange={setSummary}
                placeholder="A short paragraph capturing the whole player. Generate a draft or write from scratch."
              />
              <ReportSection
                title="Strengths"
                value={strengths}
                onChange={setStrengths}
                placeholder="Where the player is producing. Ground each claim in specific stats or coach observations."
              />
              <ReportSection
                title="Areas to work on"
                value={areas}
                onChange={setAreas}
                placeholder="Growth opportunities framed as next steps, not deficits."
              />

              {/* Footer actions — hidden in print */}
              <div className="flex flex-wrap gap-2 justify-end print:hidden">
                <Button variant="outline" onClick={handlePrint} disabled={!summary && !strengths && !areas}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button onClick={handleSave} disabled={!summary && !strengths && !areas}>
                  {savedFlash ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {savedFlash ? 'Saved' : 'Save report card'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Print stylesheet: strip chrome + keep the report card readable. */}
      <style>{`
        @media print {
          @page { margin: 0.5in; }
          body { background: white !important; }
          nav, aside, .print\\:hidden { display: none !important; }
          textarea {
            border: none !important;
            padding: 0 !important;
            background: transparent !important;
            font-family: 'Helvetica Neue', Arial, sans-serif !important;
            font-size: 11pt !important;
            resize: none !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

function ReportSection({
  title,
  value,
  onChange,
  placeholder,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <Card className="glass-card print:shadow-none print:border-none">
      <CardHeader className="pb-2 print:pb-1">
        <CardTitle className="font-display text-base uppercase tracking-wider text-muted-foreground print:text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="print:pt-0">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          placeholder={placeholder}
          className="text-sm print:text-[11pt] print:min-h-0 print:h-auto print:border-0 print:p-0"
        />
      </CardContent>
    </Card>
  );
}
