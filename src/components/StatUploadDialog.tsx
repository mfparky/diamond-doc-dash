import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Loader2, FileSpreadsheet, AlertCircle, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useStatUpload } from '@/hooks/use-stat-snapshots';
import {
  parseStatsCsv,
  matchRowsToRoster,
  type ParsedStatRow,
  type ParseStatsResult,
} from '@/lib/stat-csv';
import type { PitcherRecord } from '@/hooks/use-pitchers';
import { cn } from '@/lib/utils';

interface StatUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pitchers: PitcherRecord[];
  onSuccess?: () => void;
}

const SKIP_VALUE = '__skip__';

export function StatUploadDialog({ open, onOpenChange, pitchers, onSuccess }: StatUploadDialogProps) {
  const { toast } = useToast();
  const { upload, isUploading } = useStatUpload();

  const [filename, setFilename] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseStatsResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  /** Map from row index in parseResult.rows -> chosen pitcher id (or SKIP_VALUE). */
  const [manualMap, setManualMap] = useState<Record<number, string>>({});

  const reset = useCallback(() => {
    setFilename(null);
    setParseResult(null);
    setParseError(null);
    setManualMap({});
    setIsDragging(false);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [reset, onOpenChange],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setParseError(null);
      setManualMap({});
      setFilename(file.name);
      try {
        const text = await file.text();
        const result = parseStatsCsv(text);
        if (result.rows.length === 0) {
          throw new Error('No player rows found in this CSV.');
        }
        setParseResult(result);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Could not parse this CSV.';
        setParseError(msg);
        setParseResult(null);
      }
    },
    [],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile],
  );

  // Auto-match against the roster every time the parse result changes.
  const matchSummary = useMemo(() => {
    if (!parseResult) return null;
    return matchRowsToRoster(
      parseResult.rows,
      pitchers.map((p) => ({ id: p.id, name: p.name })),
    );
  }, [parseResult, pitchers]);

  /** Indexes of rows in parseResult.rows that did not auto-match. */
  const unmatchedIndexes = useMemo(() => {
    if (!parseResult || !matchSummary) return [];
    const matchedFullNames = new Set(matchSummary.matched.map((m) => m.fullName.toLowerCase()));
    return parseResult.rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !matchedFullNames.has(r.fullName.toLowerCase()))
      .map(({ i }) => i);
  }, [parseResult, matchSummary]);

  const totalToInsert = useMemo(() => {
    if (!parseResult || !matchSummary) return 0;
    const manualPicks = Object.values(manualMap).filter((v) => v && v !== SKIP_VALUE).length;
    return matchSummary.matched.length + manualPicks;
  }, [parseResult, matchSummary, manualMap]);

  const handleSubmit = useCallback(async () => {
    if (!parseResult || !matchSummary) return;
    const inserts = matchSummary.matched.map((m) => ({
      pitcherId: m.pitcherId,
      stats: m.stats,
    }));
    for (const idx of unmatchedIndexes) {
      const choice = manualMap[idx];
      if (!choice || choice === SKIP_VALUE) continue;
      const row = parseResult.rows[idx];
      inserts.push({ pitcherId: choice, stats: row.stats });
    }
    if (inserts.length === 0) {
      toast({
        title: 'Nothing to upload',
        description: 'No rows were matched to roster pitchers.',
        variant: 'destructive',
      });
      return;
    }
    const ok = await upload(inserts, filename);
    if (ok) {
      onSuccess?.();
      handleClose(false);
    }
  }, [
    parseResult,
    matchSummary,
    unmatchedIndexes,
    manualMap,
    filename,
    upload,
    onSuccess,
    handleClose,
    toast,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Upload season stats</DialogTitle>
          <DialogDescription>
            Drag in a GameChanger-style CSV. Each player row becomes a timestamped snapshot
            so the report can trend across uploads.
          </DialogDescription>
        </DialogHeader>

        {!parseResult && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 px-4 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/60 hover:bg-secondary/40',
            )}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={onPick}
            />
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="font-medium text-foreground">Drop a CSV here</p>
            <p className="text-sm text-muted-foreground">or tap to choose a file</p>
          </label>
        )}

        {parseError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-destructive">Could not parse {filename}</p>
              <p className="text-muted-foreground">{parseError}</p>
            </div>
          </div>
        )}

        {parseResult && matchSummary && (
          <div className="space-y-4">
            <div className="rounded-md bg-secondary/40 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <FileSpreadsheet className="w-4 h-4" />
                {filename}
              </div>
              <p className="text-muted-foreground mt-1">
                {parseResult.rows.length} player rows · {matchSummary.matched.length} auto-matched
                {unmatchedIndexes.length > 0 && ` · ${unmatchedIndexes.length} unmatched`}
              </p>
            </div>

            {unmatchedIndexes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Match remaining players
                </p>
                <p className="text-xs text-muted-foreground">
                  Pick a roster pitcher for each, or skip to leave them out of this upload.
                </p>
                <ul className="space-y-2">
                  {unmatchedIndexes.map((idx) => {
                    const row = parseResult.rows[idx];
                    return (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="flex-1 text-sm">
                          <span className="font-medium">{row.fullName}</span>
                          {row.number && (
                            <span className="text-muted-foreground"> · #{row.number}</span>
                          )}
                        </span>
                        <Select
                          value={manualMap[idx] ?? ''}
                          onValueChange={(value) =>
                            setManualMap((prev) => ({ ...prev, [idx]: value }))
                          }
                        >
                          <SelectTrigger className="w-44 h-9 text-sm">
                            <SelectValue placeholder="Choose…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP_VALUE}>Skip this row</SelectItem>
                            {pitchers.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {matchSummary.matched.length > 0 && (
              <details className="rounded-md border border-border/60 p-2 text-sm">
                <summary className="cursor-pointer font-medium">
                  Auto-matched ({matchSummary.matched.length})
                </summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {matchSummary.matched.map((m) => (
                    <li key={m.pitcherId} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary" />
                      {m.fullName}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!parseResult || totalToInsert === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading…
              </>
            ) : (
              <>Upload {totalToInsert} snapshot{totalToInsert === 1 ? '' : 's'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
