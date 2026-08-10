import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import hawksLogo from "@/assets/hawks-logo.png";
import { usePitchers } from "@/hooks/use-pitchers";
import { useAllStatSnapshots } from "@/hooks/use-stat-snapshots";
import { useLatestReportCards, type ReportCardRecord } from "@/hooks/use-report-card";
import { CoreMetricsPanel } from "@/components/CoreMetricsPanel";
import { ReportCardPrintStyles } from "@/components/ReportCardPrintStyles";
import { computeCoreMetrics, type CoreMetricInput } from "@/lib/report-card-metrics";
import { positionLabel } from "@/lib/field-positions";

const TRYOUT_PREAMBLE =
  "Every player will be evaluated at fall tryouts, and the team will be built based on positional needs, hitting, and pitching — not on returning-player status. Every spot on the roster is open.";

function friendlyDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Read-only mirror of ReportCardPage's narrative section, minus the editable
 * textarea — this page is a print/review view, not an editor.
 */
function NarrativeSection({ title, value, preamble }: { title: string; value: string; preamble?: string }) {
  if (!value) return null;
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
        <div className="rc-print-copy whitespace-pre-wrap text-sm print:text-[8.25pt]">{value}</div>
      </CardContent>
    </Card>
  );
}

function PositionsSummary({ card }: { card: ReportCardRecord }) {
  const { positionPrimary, positionSupport1, positionSupport2 } = card;
  if (!positionPrimary && !positionSupport1 && !positionSupport2) return null;
  return (
    <Card className="glass-card print:shadow-none print:border-none">
      <CardHeader className="pb-2 print:pb-1">
        <CardTitle className="font-display text-base uppercase tracking-wider text-muted-foreground print:text-foreground">
          Positions of focus
        </CardTitle>
      </CardHeader>
      <CardContent className="print:pt-0">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm rc-print-copy">
          {positionPrimary && (
            <span>
              <strong>Primary:</strong> {positionLabel(positionPrimary)}
            </span>
          )}
          {positionSupport1 && (
            <span>
              <strong>Support:</strong> {positionLabel(positionSupport1)}
            </span>
          )}
          {positionSupport2 && (
            <span>
              <strong>Support:</strong> {positionLabel(positionSupport2)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OneReportCard({
  playerName,
  card,
  teamMetricInputs,
}: {
  playerName: string;
  card: ReportCardRecord;
  teamMetricInputs: CoreMetricInput[];
}) {
  const coreMetrics = useMemo(
    () =>
      computeCoreMetrics({
        targetPitcherId: card.pitcherId,
        teamInputs: teamMetricInputs,
        adjustments: card.metricAdjustments,
      }),
    [card.pitcherId, card.metricAdjustments, teamMetricInputs],
  );

  return (
    <div className="report-card-doc space-y-4 print:space-y-3">
      <div className="rc-header">
        <div className="rc-header-band" />
        <div className="rc-header-inner">
          <img src={hawksLogo} alt="Newmarket Hawks" className="rc-logo" />
          <div className="rc-header-text">
            <p className="rc-eyebrow">Newmarket Hawks · Player Report Card</p>
            <h2 className="rc-player-name">{playerName}</h2>
            <p className="rc-period">
              {friendlyDate(card.periodStart)} — {friendlyDate(card.periodEnd)}
            </p>
          </div>
        </div>
      </div>

      <div className="rc-metrics-slot space-y-4 print:space-y-2">
        <CoreMetricsPanel metrics={coreMetrics} onAdjust={() => {}} disabled />
        <PositionsSummary card={card} />
      </div>

      <div className="rc-narratives-slot space-y-4 print:space-y-2">
        <NarrativeSection title="Summary" value={card.summary} />
        <NarrativeSection title="Strengths" value={card.strengths} />
        <NarrativeSection title="Areas to work on" value={card.areas} />
        <NarrativeSection title="Focus for Fall Tryouts" value={card.tryoutFocus} preamble={TRYOUT_PREAMBLE} />
      </div>

      <div className="rc-footer">
        <span>Newmarket Hawks · Player Report Card</span>
        <span>Generated {friendlyDate(todayIso())}</span>
      </div>
    </div>
  );
}

export default function PrintAllReportCardsPage() {
  const { pitchers, isLoading: pitchersLoading } = usePitchers();
  const pitcherIds = useMemo(() => pitchers.map((p) => p.id), [pitchers]);
  const { byPitcher, isLoading: snapshotsLoading } = useAllStatSnapshots(pitcherIds);
  const { cardsByPitcher, isLoading: cardsLoading } = useLatestReportCards(pitcherIds);

  const teamMetricInputs = useMemo<CoreMetricInput[]>(
    () =>
      pitchers.map((p) => ({
        pitcherId: p.id,
        stats: byPitcher.get(p.id)?.[0]?.stats ?? null,
        effortRating: p.effortRating,
        coachabilityRating: p.coachabilityRating,
        baseballIqRating: p.baseballIqRating,
      })),
    [pitchers, byPitcher],
  );

  // Only players with a saved card — nothing to review for the rest, and a
  // blank page in the printout would be confusing. Alphabetical so the
  // printed stack matches a roster sheet a coach would already expect.
  const entries = useMemo(
    () =>
      pitchers
        .filter((p) => cardsByPitcher.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ pitcher: p, card: cardsByPitcher.get(p.id)! })),
    [pitchers, cardsByPitcher],
  );

  const isLoading = pitchersLoading || snapshotsLoading || cardsLoading;

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="container mx-auto px-3 sm:px-4 py-6 max-w-3xl space-y-6 print:max-w-full print:px-0 print:py-0">
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/report-card" aria-label="Back to report cards">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground">Print All Report Cards</h1>
            <p className="text-sm text-muted-foreground">
              Every saved report card, one per page — review the whole roster in a single doc.
            </p>
          </div>
          <Button onClick={() => window.print()} disabled={entries.length === 0} className="shrink-0">
            <Printer className="w-4 h-4 mr-2" />
            Print / Save as PDF
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground print:hidden">Loading…</p>
        ) : entries.length === 0 ? (
          <Card className="glass-card print:hidden">
            <CardContent className="p-6 text-center space-y-2">
              <p className="text-sm text-foreground">No saved report cards yet.</p>
              <p className="text-sm text-muted-foreground">
                Write and save at least one from the{" "}
                <Link to="/report-card" className="text-primary hover:underline">
                  Report Cards
                </Link>{" "}
                page, then come back here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-xs text-muted-foreground print:hidden">
              {entries.length} of {pitchers.length} players have a saved report card.
            </p>
            <div className="space-y-8 print:space-y-0">
              {entries.map(({ pitcher, card }) => (
                <OneReportCard
                  key={pitcher.id}
                  playerName={pitcher.name}
                  card={card}
                  teamMetricInputs={teamMetricInputs}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <ReportCardPrintStyles />
    </div>
  );
}
