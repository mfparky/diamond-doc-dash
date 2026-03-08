import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trash2, BookOpen, BookOpenCheck, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import {
  ScanExample,
  getScanExamples,
  updateScanExample,
  deleteScanExample,
  correctionCount,
} from '@/lib/scan-calibration';
import { ScannedPitch } from '@/lib/scan-form';
import { CalibrationPitchPlot } from '@/components/CalibrationPitchPlot';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DiffTable({ original, corrected }: { original: ScannedPitch[]; corrected: ScannedPitch[] }) {
  const changed = corrected.filter((cp, i) => {
    const op = original[i];
    if (!op) return true;
    return Math.abs(cp.xLocation - op.xLocation) > 0.01 || Math.abs(cp.yLocation - op.yLocation) > 0.01;
  });

  if (changed.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No corrections made yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-1 pr-3">#</th>
            <th className="text-left py-1 pr-3">Original x, y</th>
            <th className="text-left py-1 pr-3">Corrected x, y</th>
            <th className="text-left py-1">Δ</th>
          </tr>
        </thead>
        <tbody>
          {changed.map((cp, i) => {
            const op = original.find(p => p.pitchNumber === cp.pitchNumber) ?? original[i];
            const dx = cp.xLocation - (op?.xLocation ?? 0);
            const dy = cp.yLocation - (op?.yLocation ?? 0);
            return (
              <tr key={i} className="border-b border-border/40">
                <td className="py-1 pr-3 text-foreground">{cp.pitchNumber}</td>
                <td className="py-1 pr-3 text-muted-foreground">
                  {op ? `${op.xLocation.toFixed(2)}, ${op.yLocation.toFixed(2)}` : '—'}
                </td>
                <td className="py-1 pr-3 text-primary">
                  {cp.xLocation.toFixed(2)}, {cp.yLocation.toFixed(2)}
                </td>
                <td className="py-1 text-yellow-500">
                  {dx >= 0 ? '+' : ''}{dx.toFixed(2)}, {dy >= 0 ? '+' : ''}{dy.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExampleCard({ example, onUpdate, onDelete }: {
  example: ScanExample;
  onUpdate: (id: string, updates: Partial<Pick<ScanExample, 'correctedPitches' | 'isEnabled'>>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [localPitches, setLocalPitches] = useState<ScannedPitch[]>(example.correctedPitches);
  const [dirty, setDirty] = useState(false);

  const handleChange = useCallback((updated: ScannedPitch[]) => {
    setLocalPitches(updated);
    setDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    onUpdate(example.id, { correctedPitches: localPitches });
    setDirty(false);
  }, [example.id, localPitches, onUpdate]);

  const handleReset = useCallback(() => {
    setLocalPitches(example.original.pitches.map(p => ({ ...p })));
    onUpdate(example.id, { correctedPitches: example.original.pitches.map(p => ({ ...p })) });
    setDirty(false);
  }, [example.id, example.original.pitches, onUpdate]);

  const toggleEnabled = useCallback(() => {
    onUpdate(example.id, { isEnabled: !example.isEnabled });
  }, [example.id, example.isEnabled, onUpdate]);

  const nCorrections = correctionCount({ ...example, correctedPitches: localPitches });

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <img
          src={example.imageDataUrl}
          alt="Form thumbnail"
          className="w-14 h-14 object-cover rounded border border-border shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {example.pitcherName || 'Unknown Pitcher'}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(example.createdAt)}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {example.original.pitches.length} pitches
            </span>
            {nCorrections > 0 && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-yellow-500 border-yellow-500/40">
                {nCorrections} corrected
              </Badge>
            )}
            {example.isEnabled && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-green-500 border-green-500/40">
                active example
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-border p-3 space-y-4">
          {example.original.pitches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pitch locations were extracted for this scan.
            </p>
          ) : (
            <>
              {/* Side-by-side on wide, stacked on narrow */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Form image */}
                <div className="sm:w-1/2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Form Image</p>
                  <img
                    src={example.imageDataUrl}
                    alt="Scanned form"
                    className="w-full rounded border border-border object-contain max-h-64"
                  />
                </div>

                {/* Interactive pitch plot */}
                <div className="sm:w-1/2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Pitch Plot — drag or tap to correct
                  </p>
                  <CalibrationPitchPlot
                    pitches={localPitches}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Action row */}
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!dirty}
                    className="h-7 text-xs"
                  >
                    Save corrections
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReset}
                    className="h-7 text-xs gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={example.isEnabled ? 'default' : 'outline'}
                    onClick={toggleEnabled}
                    className="h-7 text-xs gap-1"
                    title={example.isEnabled ? 'Remove from few-shot examples' : 'Use as few-shot example in future scans'}
                  >
                    {example.isEnabled
                      ? <><BookOpenCheck className="w-3 h-3" /> Active example</>
                      : <><BookOpen className="w-3 h-3" /> Use as example</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(example.id)}
                    className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                </div>
              </div>

              {/* Diff view */}
              <div>
                <button
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => setShowDiff(v => !v)}
                >
                  {showDiff ? 'Hide' : 'Show'} coordinate diff
                </button>
                {showDiff && (
                  <div className="mt-2 bg-secondary/30 rounded p-2">
                    <DiffTable
                      original={example.original.pitches}
                      corrected={localPitches}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function CalibratePage() {
  const navigate = useNavigate();
  const [examples, setExamples] = useState<ScanExample[]>([]);

  useEffect(() => {
    setExamples(getScanExamples());
  }, []);

  const handleUpdate = useCallback((id: string, updates: Partial<Pick<ScanExample, 'correctedPitches' | 'isEnabled'>>) => {
    updateScanExample(id, updates);
    setExamples(getScanExamples());
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteScanExample(id);
    setExamples(prev => prev.filter(e => e.id !== id));
  }, []);

  const activeCount = examples.filter(e => e.isEnabled).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-base">Scan Calibration</h1>
            {activeCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {activeCount} example{activeCount > 1 ? 's' : ''} active — injected into future scans
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 space-y-3 max-w-2xl">
        {examples.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-muted-foreground">No scans yet.</p>
            <p className="text-xs text-muted-foreground">
              Scan a paper form and it will appear here for correction.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/')}>
              Go scan a form
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Correct pitch positions, then toggle <strong>Use as example</strong> to include them in future scan prompts.
              Up to 2 active examples are injected per scan.
            </p>
            {examples.map(ex => (
              <ExampleCard
                key={ex.id}
                example={ex}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
