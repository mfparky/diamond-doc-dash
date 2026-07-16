import { useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw, Sparkles } from 'lucide-react';
import type { MetricBucket } from '@/lib/team-rankings';

/**
 * Coach-facing lever state. Kept minimal on purpose — the panel exposes the
 * highest-leverage knobs first (bucket sliders, a handful of metric toggles,
 * presets). Individual metric weights can be added later without changing
 * this shape (metricWeights is passed through untouched).
 */
export interface LeverState {
  /** Bucket weight sliders — free-range, panel normalizes for display. */
  bucketWeights: {
    offense: number;
    defense: number;
    intangibles: number;
    ipVolume: number;
  };
  /** Per-metric include/exclude toggles. */
  metricEnabled: {
    bat_2outrbi: boolean;
    /**
     * "Reward earned on-base." When true, we enable OBP as an offense metric
     * AND penalize raw walks + 6+ pitch PAs — so a kid who gets on via hits
     * / HBP wins over a kid who just takes pitches.
     */
    bat_obp: boolean;
    bat_bb: boolean;
    bat_6_pct: boolean;
    /** When false, hides the entire intangibles bucket by disabling all 3. */
    intangibles_effort: boolean;
    intangibles_coachability: boolean;
    intangibles_baseball_iq: boolean;
  };
  /**
   * Optional per-metric weight overrides. Used by presets like
   * "Defensive Juggernaut" that reshape the defense bucket to lean on
   * fielding rather than pitching metrics.
   */
  metricWeights?: Record<string, number>;
}

export const DEFAULT_LEVER_STATE: LeverState = {
  bucketWeights: { offense: 0.45, defense: 0.45, intangibles: 0.10, ipVolume: 0 },
  metricEnabled: {
    bat_2outrbi: false,
    bat_obp: false,
    bat_bb: false,
    bat_6_pct: false,
    intangibles_effort: true,
    intangibles_coachability: true,
    intangibles_baseball_iq: true,
  },
};

/**
 * Zero out every pitching metric in the defense bucket and crank fielding %
 * so the defense score reflects glove work only.
 */
const DEFENSE_JUGGERNAUT_METRIC_WEIGHTS: Record<string, number> = {
  // Silence the pitching side of the defense bucket entirely.
  pit_era: 0,
  pit_whip: 0,
  pit_k_pct_bf: 0,
  pit_baa: 0,
  pit_fps_pct: 0,
  pit_s_pct: 0,
  // Reward range and involvement — assists (bat-in-play conversions) lead,
  // then raw chances handled. FPCT / errors are down-weighted so a rangy
  // infielder who touches everything isn't punished for the occasional miss.
  field_a: 5,
  field_tc: 2,
  field_dp: 1,
  field_po: 0.5,
  field_fpct: 0.25,
  field_e: 0.25,
};

const PRESETS: Array<{ name: string; description: string; state: LeverState }> = [
  {
    name: 'Balanced',
    description: 'Even Off/Def split, intangibles small modifier',
    state: DEFAULT_LEVER_STATE,
  },
  {
    name: 'Bat-first',
    description: 'Offense-heavy for finding your bats',
    state: {
      bucketWeights: { offense: 0.60, defense: 0.30, intangibles: 0.10, ipVolume: 0 },
      metricEnabled: DEFAULT_LEVER_STATE.metricEnabled,
    },
  },
  {
    name: 'Arm-first',
    description: 'Defense-heavy + IP volume bonus for staff building',
    state: {
      bucketWeights: { offense: 0.35, defense: 0.45, intangibles: 0.05, ipVolume: 0.15 },
      metricEnabled: DEFAULT_LEVER_STATE.metricEnabled,
    },
  },
  {
    name: 'Clutch',
    description: '2-out RBI on, situational + intangibles cranked',
    state: {
      bucketWeights: { offense: 0.45, defense: 0.40, intangibles: 0.15, ipVolume: 0 },
      metricEnabled: {
        bat_2outrbi: true,
        bat_obp: false,
        bat_bb: false,
        bat_6_pct: false,
        intangibles_effort: true,
        intangibles_coachability: true,
        intangibles_baseball_iq: true,
      },
    },
  },
  {
    name: 'Defensive Juggernaut',
    description: 'Glove-first — fielding % over pitching in the defense bucket',
    state: {
      bucketWeights: { offense: 0.25, defense: 0.65, intangibles: 0.10, ipVolume: 0 },
      metricEnabled: DEFAULT_LEVER_STATE.metricEnabled,
      metricWeights: DEFENSE_JUGGERNAUT_METRIC_WEIGHTS,
    },
  },
  {
    name: 'Pure stats',
    description: 'Turn off intangibles — just what the CSV says',
    state: {
      bucketWeights: { offense: 0.50, defense: 0.50, intangibles: 0, ipVolume: 0 },
      metricEnabled: {
        bat_2outrbi: false,
        intangibles_effort: false,
        intangibles_coachability: false,
        intangibles_baseball_iq: false,
      },
    },
  },
];

interface LeversPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levers: LeverState;
  onChange: (next: LeverState) => void;
}

const BUCKET_COLOR: Record<MetricBucket | 'ipVolume', string> = {
  offense: 'bg-primary',
  defense: 'bg-sky-500',
  intangibles: 'bg-amber-500',
  ipVolume: 'bg-emerald-500',
};

export function LeversPanel({ open, onOpenChange, levers, onChange }: LeversPanelProps) {
  const sum =
    levers.bucketWeights.offense +
    levers.bucketWeights.defense +
    levers.bucketWeights.intangibles +
    levers.bucketWeights.ipVolume;

  const shares = useMemo(
    () => ({
      offense: sum > 0 ? levers.bucketWeights.offense / sum : 0,
      defense: sum > 0 ? levers.bucketWeights.defense / sum : 0,
      intangibles: sum > 0 ? levers.bucketWeights.intangibles / sum : 0,
      ipVolume: sum > 0 ? levers.bucketWeights.ipVolume / sum : 0,
    }),
    [levers.bucketWeights, sum],
  );

  const setBucket = (bucket: keyof LeverState['bucketWeights'], value: number) => {
    onChange({
      ...levers,
      bucketWeights: { ...levers.bucketWeights, [bucket]: value },
    });
  };

  const setMetric = (key: keyof LeverState['metricEnabled'], value: boolean) => {
    onChange({
      ...levers,
      metricEnabled: { ...levers.metricEnabled, [key]: value },
    });
  };

  const applyPreset = (state: LeverState) => {
    onChange(state);
  };

  const activePreset = useMemo(() => {
    return PRESETS.find((p) => JSON.stringify(p.state) === JSON.stringify(levers));
  }, [levers]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Levers
          </SheetTitle>
          <SheetDescription>
            Tune weights and toggles to see how Player Value shifts. Chart updates live.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Presets */}
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Presets
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => {
                const isActive = activePreset?.name === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p.state)}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      isActive
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border/60 hover:border-primary/40 hover:bg-secondary/40 text-foreground'
                    }`}
                  >
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Bucket weight sliders */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Bucket weights
              </p>
              <span className="text-[10px] text-muted-foreground">Auto-normalized</span>
            </div>

            {/* Live normalized bar */}
            <div className="flex w-full h-3 rounded-md overflow-hidden border border-border/40">
              {(['offense', 'defense', 'intangibles', 'ipVolume'] as const).map((b) => {
                const share = shares[b];
                if (share <= 0) return null;
                return (
                  <div
                    key={b}
                    className={BUCKET_COLOR[b]}
                    style={{ width: `${share * 100}%` }}
                    title={`${b} — ${Math.round(share * 100)}%`}
                  />
                );
              })}
            </div>

            <BucketSlider
              label="Offense"
              value={levers.bucketWeights.offense}
              share={shares.offense}
              onChange={(v) => setBucket('offense', v)}
              color="text-primary"
            />
            <BucketSlider
              label="Defense"
              value={levers.bucketWeights.defense}
              share={shares.defense}
              onChange={(v) => setBucket('defense', v)}
              color="text-sky-500"
            />
            <BucketSlider
              label="Intangibles"
              value={levers.bucketWeights.intangibles}
              share={shares.intangibles}
              onChange={(v) => setBucket('intangibles', v)}
              color="text-amber-500"
            />
            <BucketSlider
              label="IP Volume Bonus"
              value={levers.bucketWeights.ipVolume}
              share={shares.ipVolume}
              onChange={(v) => setBucket('ipVolume', v)}
              color="text-emerald-500"
              hint="Rewards innings-eaters. 0 = off (default)."
            />
          </section>

          {/* Metric toggles */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Metrics
            </p>

            <MetricToggle
              id="lever-2outrbi"
              label="2-out RBI"
              description="Reward players who come through with two outs."
              checked={levers.metricEnabled.bat_2outrbi}
              onChange={(v) => setMetric('bat_2outrbi', v)}
            />
            <MetricToggle
              id="lever-effort"
              label="Effort rating"
              description="Include coach-assigned effort in the intangibles bucket."
              checked={levers.metricEnabled.intangibles_effort}
              onChange={(v) => setMetric('intangibles_effort', v)}
            />
            <MetricToggle
              id="lever-coach"
              label="Coachability rating"
              description="Include coach-assigned coachability."
              checked={levers.metricEnabled.intangibles_coachability}
              onChange={(v) => setMetric('intangibles_coachability', v)}
            />
            <MetricToggle
              id="lever-iq"
              label="Baseball IQ rating"
              description="Include coach-assigned baseball IQ."
              checked={levers.metricEnabled.intangibles_baseball_iq}
              onChange={(v) => setMetric('intangibles_baseball_iq', v)}
            />
          </section>

          {/* Reset */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => onChange(DEFAULT_LEVER_STATE)}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BucketSlider({
  label,
  value,
  share,
  onChange,
  color,
  hint,
}: {
  label: string;
  value: number;
  share: number;
  onChange: (v: number) => void;
  color: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-sm font-medium ${color}`}>{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(share * 100)}%
        </span>
      </div>
      <Slider
        value={[value]}
        max={1}
        step={0.05}
        onValueChange={(v) => onChange(v[0] ?? 0)}
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MetricToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
