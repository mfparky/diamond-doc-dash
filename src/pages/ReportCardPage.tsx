import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Wand2, Save, FileDown, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import hawksLogo from '@/assets/hawks-logo.png';
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
import { CoreMetricsPanel } from '@/components/CoreMetricsPanel';
import {
  bandLabel,
  clampAdjustment,
  computeCoreMetrics,
  type CoreMetricInput,
} from '@/lib/report-card-metrics';

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
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Hydrate the form from whichever card was just loaded. When the coach
  // switches players and the new player has no saved card (card === null),
  // this resets the form to blank instead of leaving the previous player's
  // text sitting there — which would otherwise get saved under the new
  // player's id on the next Save click.
  useEffect(() => {
    setContext(card?.coachContext ?? '');
    setSummary(card?.summary ?? '');
    setStrengths(card?.strengths ?? '');
    setAreas(card?.areas ?? '');
    setAdjustments(card?.metricAdjustments ?? {});
  }, [card, playerId]);

  // Team-wide inputs feed the percentile pool. Latest snapshot per pitcher.
  const teamMetricInputs = useMemo<CoreMetricInput[]>(() => {
    return pitchers.map((p) => ({
      pitcherId: p.id,
      stats: byPitcher.get(p.id)?.[0]?.stats ?? null,
      effortRating: p.effortRating,
      coachabilityRating: p.coachabilityRating,
      baseballIqRating: p.baseballIqRating,
    }));
  }, [pitchers, byPitcher]);

  const coreMetrics = useMemo(() => {
    if (!playerId) return [];
    return computeCoreMetrics({
      targetPitcherId: playerId,
      teamInputs: teamMetricInputs,
      adjustments,
    });
  }, [playerId, teamMetricInputs, adjustments]);

  const handleAdjustMetric = (key: string, next: number) => {
    setAdjustments((prev) => {
      const clamped = clampAdjustment(next);
      const out = { ...prev };
      if (clamped === 0) delete out[key];
      else out[key] = clamped;
      return out;
    });
  };

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
        coreMetrics: coreMetrics
          .filter((m) => m.band !== null)
          .map((m) => ({
            label: m.def.label,
            band: bandLabel(m.band),
            coachAdjusted: m.adjustment !== 0,
          })),
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
      metricAdjustments: adjustments,
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
            <div className="report-card-doc space-y-4 print:space-y-3">
              {/* Branded header — different on screen vs print */}
              <div className="rc-header">
                <div className="rc-header-band" />
                <div className="rc-header-inner">
                  <img src={hawksLogo} alt="Newmarket Hawks" className="rc-logo" />
                  <div className="rc-header-text">
                    <p className="rc-eyebrow">Newmarket Hawks · Player Report Card</p>
                    <h2 className="rc-player-name">{player.name}</h2>
                    <p className="rc-period">{friendlyDate(start)} — {friendlyDate(end)}</p>
                  </div>
                </div>
              </div>

              <div className="rc-metrics-slot">
                <CoreMetricsPanel
                  metrics={coreMetrics}
                  onAdjust={handleAdjustMetric}
                />
              </div>

              <div className="rc-narratives-slot space-y-4 print:space-y-2">
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
              </div>

              {/* Branded footer — visible only in print */}
              <div className="rc-footer">
                <span>Newmarket Hawks · Player Report Card</span>
                <span>Generated {friendlyDate(todayIso())}</span>
              </div>

              {/* Footer actions — hidden in print */}
              <div className="flex flex-wrap gap-2 justify-end print:hidden">
                <Button variant="outline" onClick={handlePrint} disabled={!summary && !strengths && !areas}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Download PDF
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

      {/* Screen + print stylesheet for the branded report card. */}
      <style>{`
        /* On-screen branded header — visible above the metrics + narrative */
        .rc-header {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid hsl(var(--border) / 0.6);
          background: linear-gradient(135deg,
            hsl(var(--background)) 0%,
            hsl(var(--muted) / 0.4) 100%);
        }
        .rc-header-band {
          height: 6px;
          background: linear-gradient(90deg,
            #ef4444 0%,
            #f59e0b 33%,
            #84cc16 66%,
            #10b981 100%);
        }
        .rc-header-inner {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
        }
        .rc-logo {
          height: 64px;
          width: auto;
          flex-shrink: 0;
        }
        .rc-eyebrow {
          font-size: 0.6875rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: hsl(var(--muted-foreground));
          margin: 0 0 0.25rem 0;
          font-weight: 600;
        }
        .rc-player-name {
          font-family: var(--font-display, 'Helvetica Neue', Arial, sans-serif);
          font-size: 1.875rem;
          font-weight: 700;
          margin: 0;
          line-height: 1.1;
          color: hsl(var(--foreground));
        }
        .rc-period {
          font-size: 0.875rem;
          color: hsl(var(--muted-foreground));
          margin: 0.25rem 0 0 0;
        }
        .rc-footer { display: none; }

        @media print {
          /* Landscape letter — the whole report card fits one page. */
          @page { margin: 0.35in; size: letter landscape; }
          html, body {
            background: white !important;
            color: #111 !important;
            font-family: 'Helvetica Neue', Arial, sans-serif !important;
          }
          nav, aside, .print\\:hidden { display: none !important; }

          /* Keep gradient/color backgrounds when saving as PDF. */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Reset page container padding for edge-to-edge headers. */
          .container { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }

          /* --- Two-column landscape layout ---
             Grid areas: header spans both columns, metrics on the left,
             narratives on the right, footer full-width at the bottom.
             Tailwind space-y-* margins on the doc's direct children are
             zeroed out below so grid gap controls spacing. */
          .report-card-doc {
            display: grid;
            grid-template-columns: 36% 1fr;
            grid-template-areas:
              "header    header"
              "metrics   narratives"
              "footer    footer";
            column-gap: 18pt;
            row-gap: 8pt;
            page-break-inside: avoid;
          }
          .report-card-doc > * { margin-top: 0 !important; margin-bottom: 0 !important; }
          .rc-header { grid-area: header; }
          .rc-metrics-slot { grid-area: metrics; }
          .rc-narratives-slot { grid-area: narratives; }
          .rc-footer { grid-area: footer; }

          /* --- Branded header --- */
          .rc-header {
            border: none !important;
            border-radius: 0 !important;
            background: white !important;
            page-break-after: avoid;
          }
          .rc-header-band {
            height: 4pt;
            border-radius: 0 !important;
          }
          .rc-header-inner {
            padding: 8pt 0 6pt 0;
            border-bottom: 0.75pt solid #222;
            gap: 14pt !important;
          }
          .rc-logo { height: 42pt; }
          .rc-eyebrow {
            color: #6b7280 !important;
            font-size: 7pt;
          }
          .rc-player-name {
            color: #111 !important;
            font-size: 18pt;
          }
          .rc-period {
            color: #4b5563 !important;
            font-size: 9.5pt;
          }

          /* --- Card container styling — clean, borderless in print --- */
          .glass-card {
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid;
          }
          /* Trim card header/content padding so more content fits. */
          .glass-card [class*="CardHeader"], .rc-narratives-slot [class*="pb-2"] {
            padding: 0 !important;
          }

          /* --- Section headings --- */
          [class*="uppercase"][class*="tracking-wider"] {
            color: #111 !important;
            font-size: 9pt !important;
            letter-spacing: 0.12em !important;
            border-bottom: 0.5pt solid #d1d5db !important;
            padding-bottom: 2pt !important;
            margin-bottom: 3pt !important;
          }

          /* --- Narrative copy in print --- flows as a paragraph so
             the full content prints (textareas don't auto-grow). */
          .rc-print-copy {
            color: #111 !important;
            font-family: 'Helvetica Neue', Arial, sans-serif !important;
            font-size: 8.75pt !important;
            line-height: 1.35 !important;
            margin: 0 0 4pt 0 !important;
          }
          .rc-narratives-slot { font-size: 8.75pt; }
          .rc-narratives-slot .glass-card + .glass-card { margin-top: 4pt !important; }

          /* --- Metrics panel — tighter for landscape column --- */
          .rc-metrics-slot .space-y-3 > * + * { margin-top: 5pt !important; }
          .rc-metrics-slot .text-sm { font-size: 8.5pt !important; }
          .rc-metrics-slot .text-xs { font-size: 7.5pt !important; }

          /* --- Print-only branded footer --- */
          .rc-footer {
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            border-top: 0.5pt solid #d1d5db;
            padding-top: 5pt;
            margin-top: 8pt !important;
            font-size: 7.5pt;
            color: #6b7280;
            page-break-inside: avoid;
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
        {/* On-screen editable textarea — hidden in print. */}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          placeholder={placeholder}
          className="text-sm print:hidden"
        />
        {/* Print-only mirror. Textareas don't auto-grow in print so we
            render the value as a flowing paragraph block instead — this
            guarantees the full copy shows up in the exported PDF. */}
        <div className="hidden print:block rc-print-copy whitespace-pre-wrap">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
