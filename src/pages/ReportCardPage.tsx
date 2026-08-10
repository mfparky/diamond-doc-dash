import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Wand2, Save, FileDown, CheckCircle2, AlertTriangle, Loader2, Radio } from "lucide-react";
import hawksLogo from "@/assets/hawks-logo.png";
import { usePitchers } from "@/hooks/use-pitchers";
import { useAllStatSnapshots } from "@/hooks/use-stat-snapshots";
import { useReportCard } from "@/hooks/use-report-card";
import { generateReportCardDraft, ReportCardLLMError, type ReportCardInput } from "@/lib/report-card-llm";
import { useToast } from "@/hooks/use-toast";
import { getStoredApiKey } from "@/lib/scan-form";
import { CoreMetricsPanel } from "@/components/CoreMetricsPanel";
import { ReportCardPrintStyles } from "@/components/ReportCardPrintStyles";
import { bandLabel, clampAdjustment, computeCoreMetrics, type CoreMetricInput } from "@/lib/report-card-metrics";
import { FIELD_POSITIONS, positionLabel } from "@/lib/field-positions";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function friendlyDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Fixed, non-editable — every printed report card shows identical wording so
// no parent can read favoritism into a difference in phrasing between players.
const TRYOUT_PREAMBLE =
  "Every player will be evaluated at fall tryouts, and the team will be built based on positional needs, hitting, and pitching — not on returning-player status. Every spot on the roster is open.";

// Hard character caps — keep the printed card on one page. Also the source
// of truth for the AI draft: a generated field landing AT or OVER its
// textarea's native maxLength blocks further typing (backspace still works,
// which is why that bug looks like "can't type, only delete") until the
// coach deletes below the cap, so generated text is truncated to these same
// numbers before it ever reaches the form.
const MAX_SUMMARY_LENGTH = 400;
const MAX_STRENGTHS_LENGTH = 600;
const MAX_AREAS_LENGTH = 600;
const MAX_TRYOUT_FOCUS_LENGTH = 600;

export default function ReportCardPage() {
  const { toast } = useToast();
  const [search, setSearch] = useSearchParams();

  const { pitchers, isLoading: pitchersLoading } = usePitchers();
  const pitcherIds = useMemo(() => pitchers.map((p) => p.id), [pitchers]);
  const { byPitcher, isLoading: snapshotsLoading } = useAllStatSnapshots(pitcherIds);

  const playerId = search.get("playerId") ?? "";
  const initialStart = search.get("start") ?? isoDaysAgo(60);
  const initialEnd = search.get("end") ?? todayIso();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);

  const player = useMemo(() => pitchers.find((p) => p.id === playerId), [pitchers, playerId]);
  const snapshots = useMemo(() => (playerId ? (byPitcher.get(playerId) ?? []) : []), [byPitcher, playerId]);
  const latestSnapshot = snapshots[0];
  const previousSnapshot = snapshots[1];

  const { card, isLoading: cardLoading, save } = useReportCard(playerId || undefined, start, end);

  const [context, setContext] = useState("");
  const [summary, setSummary] = useState("");
  const [strengths, setStrengths] = useState("");
  const [areas, setAreas] = useState("");
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [positionPrimary, setPositionPrimary] = useState("");
  const [positionSupport1, setPositionSupport1] = useState("");
  const [positionSupport2, setPositionSupport2] = useState("");
  const [tryoutFocus, setTryoutFocus] = useState("");
  const [published, setPublished] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Hydrate the form from whichever card was just loaded. When the coach
  // switches players and the new player has no saved card (card === null),
  // this resets the form to blank instead of leaving the previous player's
  // text sitting there — which would otherwise get saved under the new
  // player's id on the next Save click.
  useEffect(() => {
    setContext(card?.coachContext ?? "");
    setSummary(card?.summary ?? "");
    setStrengths(card?.strengths ?? "");
    setAreas(card?.areas ?? "");
    setAdjustments(card?.metricAdjustments ?? {});
    setPositionPrimary(card?.positionPrimary ?? "");
    setPositionSupport1(card?.positionSupport1 ?? "");
    setPositionSupport2(card?.positionSupport2 ?? "");
    setTryoutFocus(card?.tryoutFocus ?? "");
    setPublished(card?.published ?? false);
  }, [card, playerId]);

  // Shared payload builder for the Save button.
  const buildDraftPatch = useCallback(
    () => ({
      coachContext: context,
      summary,
      strengths,
      areas,
      snapshotId: latestSnapshot?.id ?? null,
      metricAdjustments: adjustments,
      positionPrimary: positionPrimary || null,
      positionSupport1: positionSupport1 || null,
      positionSupport2: positionSupport2 || null,
      tryoutFocus,
    }),
    [
      context,
      summary,
      strengths,
      areas,
      latestSnapshot,
      adjustments,
      positionPrimary,
      positionSupport1,
      positionSupport2,
      tryoutFocus,
    ],
  );

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
        title: "Anthropic API key needed",
        description: "Set one from the paper-form scanner. Coaches BYOK for AI drafts.",
        variant: "destructive",
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
      // Guaranteed backstop regardless of how well the model followed the
      // prompt's character targets — a field landing at/over its textarea's
      // maxLength blocks further typing until the coach deletes below the
      // cap (backspace still works, which is why that bug looks like
      // "can't type, only delete").
      setSummary(draft.summary.slice(0, MAX_SUMMARY_LENGTH));
      setStrengths(draft.strengths.slice(0, MAX_STRENGTHS_LENGTH));
      setAreas(draft.areas.slice(0, MAX_AREAS_LENGTH));
      setTryoutFocus(draft.tryoutFocus.slice(0, MAX_TRYOUT_FOCUS_LENGTH));
      toast({ title: "Draft ready", description: "Review and edit the sections before saving." });
    } catch (e) {
      const msg = e instanceof ReportCardLLMError ? e.message : "Could not generate the draft. Try again.";
      toast({ title: "Draft failed", description: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!player) return;
    const ok = await save({ ...buildDraftPatch(), published });
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
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link to="/report-card/print-all">Print all</Link>
          </Button>
        </div>

        {/* Player picker + period */}
        <Card className="glass-card print:hidden">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rc-player" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Player
                </Label>
                <select
                  id="rc-player"
                  className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
                  value={playerId}
                  onChange={(e) => setSearch({ playerId: e.target.value, start, end }, { replace: true })}
                >
                  <option value="">Pick a player…</option>
                  {pitchers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rc-start" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Period start
                </Label>
                <Input id="rc-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rc-end" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Period end
                </Label>
                <Input id="rc-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>

            {!hasApiKey && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-amber-800 dark:text-amber-200">
                  No Anthropic API key configured. Set one from the paper-form scanner to enable AI-drafted narratives.
                  You can still write and save the sections by hand.
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
                  What do you want the draft to weave in? Anecdotes, specific games, growth moments, focus areas —
                  anything the stats can't tell.
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
                    {generating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4 mr-2" />
                    )}
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
                    <p className="rc-period">
                      {friendlyDate(start)} — {friendlyDate(end)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rc-metrics-slot space-y-4 print:space-y-2">
                <CoreMetricsPanel metrics={coreMetrics} onAdjust={handleAdjustMetric} />
                <PositionOfFocus
                  primary={positionPrimary}
                  support1={positionSupport1}
                  support2={positionSupport2}
                  onPrimaryChange={setPositionPrimary}
                  onSupport1Change={setPositionSupport1}
                  onSupport2Change={setPositionSupport2}
                />
              </div>

              <div className="rc-narratives-slot space-y-4 print:space-y-2">
                <ReportSection
                  title="Summary"
                  value={summary}
                  onChange={setSummary}
                  placeholder="A short paragraph capturing the whole player. Generate a draft or write from scratch."
                  maxLength={MAX_SUMMARY_LENGTH}
                  rows={4}
                />
                <ReportSection
                  title="Strengths"
                  value={strengths}
                  onChange={setStrengths}
                  placeholder="Where the player is producing. Ground each claim in specific stats or coach observations."
                  maxLength={MAX_STRENGTHS_LENGTH}
                  rows={5}
                />
                <ReportSection
                  title="Areas to work on"
                  value={areas}
                  onChange={setAreas}
                  placeholder="Growth opportunities framed as next steps, not deficits."
                  maxLength={MAX_AREAS_LENGTH}
                  rows={5}
                />
                <ReportSection
                  title="Focus for Fall Tryouts"
                  preamble={TRYOUT_PREAMBLE}
                  value={tryoutFocus}
                  onChange={setTryoutFocus}
                  placeholder="What should this player work on before fall tryouts to compete for a spot?"
                  maxLength={MAX_TRYOUT_FOCUS_LENGTH}
                  rows={5}
                />
              </div>

              {/* Publish control — coach decides if/when this specific player's
                  card is visible on their public dashboard. Off by default. */}
              <div className="print:hidden rounded-lg border border-border/60 bg-secondary/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${published ? "bg-success/10" : "bg-muted"}`}>
                      <Radio className={`w-4 h-4 ${published ? "text-success" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <Label htmlFor="rc-publish" className="text-sm font-medium text-foreground cursor-pointer">
                        Publish to {player.name}'s dashboard
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                        When on and saved, this report card appears on {player.name}'s public dashboard — and only
                        theirs. Off by default; turn off any time to pull it back down.
                      </p>
                      {card?.published && (
                        <p className="text-xs text-success mt-1 font-medium">
                          Live now
                          {card.publishedAt ? ` · last published ${friendlyDate(card.publishedAt.slice(0, 10))}` : ""}
                        </p>
                      )}
                      {!card?.published && published && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                          Not live yet — click Save to publish
                        </p>
                      )}
                      {card?.published && !published && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                          Still live — click Save to pull it down
                        </p>
                      )}
                    </div>
                  </div>
                  <Switch id="rc-publish" checked={published} onCheckedChange={setPublished} />
                </div>
              </div>

              {/* Branded footer — visible only in print */}
              <div className="rc-footer">
                <span>Newmarket Hawks · Player Report Card</span>
                <span>Generated {friendlyDate(todayIso())}</span>
              </div>

              {/* Footer actions — hidden in print */}
              <div className="flex flex-wrap items-center gap-2 justify-end print:hidden">
                <Button
                  variant="outline"
                  onClick={handlePrint}
                  disabled={!summary && !strengths && !areas && !tryoutFocus}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button onClick={handleSave} disabled={!summary && !strengths && !areas && !tryoutFocus}>
                  {savedFlash ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {savedFlash ? "Saved" : "Save report card"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Screen + print stylesheet for the branded report card. */}
      <ReportCardPrintStyles />
    </div>
  );
}

function PositionOfFocus({
  primary,
  support1,
  support2,
  onPrimaryChange,
  onSupport1Change,
  onSupport2Change,
}: {
  primary: string;
  support1: string;
  support2: string;
  onPrimaryChange: (v: string) => void;
  onSupport1Change: (v: string) => void;
  onSupport2Change: (v: string) => void;
}) {
  const hasAny = !!(primary || support1 || support2);

  return (
    <Card className={`glass-card print:shadow-none print:border-none ${hasAny ? "" : "print:hidden"}`}>
      <CardHeader className="pb-2 print:pb-1">
        <CardTitle className="font-display text-base uppercase tracking-wider text-muted-foreground print:text-foreground">
          Positions of focus
        </CardTitle>
        <p className="text-xs text-muted-foreground print:hidden">
          Pick a primary position and up to two supporting positions to show on the printout.
        </p>
      </CardHeader>
      <CardContent className="print:pt-0">
        {/* On-screen pickers — hidden in print. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
          <div className="space-y-1">
            <Label htmlFor="rc-pos-primary" className="text-xs text-muted-foreground">
              Primary
            </Label>
            <select
              id="rc-pos-primary"
              className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
              value={primary}
              onChange={(e) => onPrimaryChange(e.target.value)}
            >
              <option value="">None</option>
              {FIELD_POSITIONS.filter((p) => p.value !== support1 && p.value !== support2).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rc-pos-support1" className="text-xs text-muted-foreground">
              Support 1
            </Label>
            <select
              id="rc-pos-support1"
              className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
              value={support1}
              onChange={(e) => onSupport1Change(e.target.value)}
            >
              <option value="">None</option>
              {FIELD_POSITIONS.filter((p) => p.value !== primary && p.value !== support2).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rc-pos-support2" className="text-xs text-muted-foreground">
              Support 2
            </Label>
            <select
              id="rc-pos-support2"
              className="w-full h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
              value={support2}
              onChange={(e) => onSupport2Change(e.target.value)}
            >
              <option value="">None</option>
              {FIELD_POSITIONS.filter((p) => p.value !== primary && p.value !== support1).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Print-only mirror. */}
        {hasAny && (
          <div className="hidden print:flex print:flex-wrap print:gap-x-4 rc-print-copy">
            {primary && (
              <span>
                <strong>Primary:</strong> {positionLabel(primary)}
              </span>
            )}
            {support1 && (
              <span>
                <strong>Support:</strong> {positionLabel(support1)}
              </span>
            )}
            {support2 && (
              <span>
                <strong>Support:</strong> {positionLabel(support2)}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportSection({
  title,
  value,
  onChange,
  placeholder,
  preamble,
  maxLength,
  rows = 6,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Fixed, non-editable text shown above the textarea on screen AND in print. */
  preamble?: string;
  /** Hard character cap — keeps the printed card on one page. */
  maxLength?: number;
  rows?: number;
}) {
  return (
    <Card className="glass-card print:shadow-none print:border-none">
      <CardHeader className="pb-2 print:pb-1">
        <CardTitle className="font-display text-base uppercase tracking-wider text-muted-foreground print:text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="print:pt-0">
        {preamble && (
          <p className="mb-3 text-xs italic text-muted-foreground border-l-2 border-primary/50 pl-3 print:text-foreground print:border-black/50 rc-print-copy">
            {preamble}
          </p>
        )}
        {/* On-screen editable textarea — hidden in print. */}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          className="text-sm print:hidden"
        />
        {maxLength && (
          <p className="mt-1 text-[11px] text-muted-foreground text-right print:hidden">
            {value.length} / {maxLength}
          </p>
        )}
        {/* Print-only mirror. Textareas don't auto-grow in print so we
            render the value as a flowing paragraph block instead — this
            guarantees the full copy shows up in the exported PDF. */}
        <div className="hidden print:block rc-print-copy whitespace-pre-wrap">{value}</div>
      </CardContent>
    </Card>
  );
}
