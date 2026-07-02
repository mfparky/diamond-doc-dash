import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  bandLabel,
  clampAdjustment,
  type CoreMetric,
  type MetricBand,
} from '@/lib/report-card-metrics';

interface CoreMetricsPanelProps {
  metrics: CoreMetric[];
  onAdjust: (key: string, adjustment: number) => void;
  disabled?: boolean;
}

const BAND_STYLES: Record<MetricBand, { fillPct: number; bar: string; label: string; print: string }> = {
  'needs-work': {
    fillPct: 25,
    bar: 'bg-red-500',
    label: 'text-red-700 dark:text-red-300',
    print: 'print:bg-red-400',
  },
  developing: {
    fillPct: 50,
    bar: 'bg-amber-500',
    label: 'text-amber-700 dark:text-amber-300',
    print: 'print:bg-amber-400',
  },
  strong: {
    fillPct: 75,
    bar: 'bg-lime-500',
    label: 'text-lime-700 dark:text-lime-300',
    print: 'print:bg-lime-400',
  },
  excelling: {
    fillPct: 100,
    bar: 'bg-emerald-500',
    label: 'text-emerald-700 dark:text-emerald-300',
    print: 'print:bg-emerald-500',
  },
};

function formatValue(rawValue: number, key: string): string {
  if (!Number.isFinite(rawValue)) return '—';
  // Coach ratings live on a 0/50/100 scale — hide the number itself and just
  // let the band communicate the level.
  if (key.startsWith('intangibles_')) return '';
  if (key === 'bat_ops' || key === 'bat_ba_pct_risp' || key === 'field_fpct') {
    return rawValue.toFixed(3).replace(/^0\./, '.');
  }
  if (key === 'pit_era') return rawValue.toFixed(2);
  if (key === 'pit_s_pct' || key === 'bat_k_pct') return `${rawValue.toFixed(0)}%`;
  return rawValue.toFixed(2);
}

export function CoreMetricsPanel({ metrics, onAdjust, disabled }: CoreMetricsPanelProps) {
  return (
    <Card className="glass-card print:shadow-none print:border-none">
      <CardHeader className="pb-2 print:pb-1">
        <CardTitle className="font-display text-base uppercase tracking-wider text-muted-foreground print:text-foreground">
          Core metrics
        </CardTitle>
        <p className="text-xs text-muted-foreground print:hidden">
          Each metric is scaled against the rest of the team. Use — / + when you see
          something the numbers don't capture.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 print:pt-0">
        {metrics.map((m) => (
          <MetricRow key={m.def.key} metric={m} onAdjust={onAdjust} disabled={disabled} />
        ))}
      </CardContent>
    </Card>
  );
}

function MetricRow({
  metric,
  onAdjust,
  disabled,
}: {
  metric: CoreMetric;
  onAdjust: (key: string, adjustment: number) => void;
  disabled?: boolean;
}) {
  const style = metric.band ? BAND_STYLES[metric.band] : null;
  const fillPct = style ? style.fillPct : 0;
  const nudged = metric.adjustment !== 0;
  const canDecrement = metric.adjustment > -2;
  const canIncrement = metric.adjustment < 2;

  const handleAdjust = (delta: number) => {
    if (disabled) return;
    onAdjust(metric.def.key, clampAdjustment(metric.adjustment + delta));
  };

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-foreground">{metric.def.label}</span>
        <span className="text-xs text-muted-foreground">
          {formatValue(metric.rawValue, metric.def.key)}
        </span>
        <span
          className={`ml-auto text-xs font-semibold ${style?.label ?? 'text-muted-foreground'} print:text-foreground`}
        >
          {bandLabel(metric.band)}
          {nudged && (
            <span className="ml-1 text-muted-foreground">
              (coach {metric.adjustment > 0 ? '+' : ''}{metric.adjustment})
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Gradient rail with a solid fill up to the band. */}
        <div className="relative flex-1 h-2.5 rounded-full overflow-hidden bg-muted print:bg-neutral-200 print:border print:border-neutral-300">
          <div
            className={`h-full rounded-full ${style?.bar ?? 'bg-transparent'} ${style?.print ?? ''} transition-all`}
            style={{ width: `${fillPct}%` }}
            aria-hidden
          />
        </div>

        {/* Coach nudge controls — print-hidden. */}
        <div className="flex items-center gap-1 print:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleAdjust(-1)}
            disabled={disabled || !canDecrement || !metric.band}
            aria-label={`Lower band for ${metric.def.label}`}
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleAdjust(1)}
            disabled={disabled || !canIncrement || !metric.band}
            aria-label={`Raise band for ${metric.def.label}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug print:hidden">
        {metric.def.description}
      </p>
    </div>
  );
}
