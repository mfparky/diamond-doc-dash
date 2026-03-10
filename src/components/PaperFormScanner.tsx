import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Loader2, CheckCircle, AlertCircle, Key, RefreshCw } from 'lucide-react';
import { scanPaperForm, getStoredApiKey, saveApiKey, ScannedOuting, ScannedPitch } from '@/lib/scan-form';
import { addScanExample } from '@/lib/scan-calibration';
import { isStrike as computeIsStrike } from '@/lib/strike-zone';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';
import { CalibrationPitchPlot } from './CalibrationPitchPlot';
import { Pitcher, Outing } from '@/types/pitcher';
import { useToast } from '@/hooks/use-toast';

// Map scanned pitch type → pitch type number using pitcher's config.
// The form uses numbers ("1", "2", "3") directly; fall back to label lookup for legacy data.
function pitchLabelToNumber(label: string, pitchTypes: PitchTypeConfig): number {
  const asInt = parseInt(label);
  if (!isNaN(asInt) && asInt >= 1) return asInt;
  const upper = label.toUpperCase();
  for (const [key, val] of Object.entries(pitchTypes)) {
    if (val.toUpperCase() === upper) return parseInt(key);
  }
  return 1; // default to first pitch type
}

// Convert base64 data URL to raw base64 + media type
function parseDataUrl(dataUrl: string): { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' } {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const mediaType = (['image/jpeg', 'image/png', 'image/webp'].includes(mime)
    ? mime
    : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp';
  return { base64, mediaType };
}


interface Props {
  open: boolean;
  onClose: () => void;
  pitchers: Pitcher[];
  pitchTypes?: PitchTypeConfig;
  onSave: (
    outingData: Omit<Outing, 'id' | 'timestamp'>,
    pitcherId: string,
    pitches: Array<{ pitchNumber: number; pitchType: number; xLocation: number; yLocation: number; isStrike: boolean }>
  ) => Promise<void>;
}

type Step = 'capture' | 'scanning' | 'review' | 'error';

export function PaperFormScanner({ open, onClose, pitchers, pitchTypes = DEFAULT_PITCH_TYPES, onSave }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('capture');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(() => getStoredApiKey());
  const [showApiKeyInput, setShowApiKeyInput] = useState(() => !getStoredApiKey());
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Scanned data (editable after review)
  const [scanned, setScanned] = useState<ScannedOuting | null>(null);
  const [editPitches, setEditPitches] = useState<ScannedPitch[]>([]);
  const [selectedPitcherId, setSelectedPitcherId] = useState<string>('');
  const [editPitchCount, setEditPitchCount] = useState('');
  const [editStrikes, setEditStrikes] = useState('');
  const [editMaxVelo, setEditMaxVelo] = useState('');
  const [editFocus, setEditFocus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editEventType, setEditEventType] = useState<Outing['eventType']>('Bullpen');
  const [editDate, setEditDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleReset = useCallback(() => {
    setStep('capture');
    setImageDataUrl(null);
    setScanned(null);
    setEditFocus('');
    setError('');
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setImageDataUrl(dataUrl);

      const key = apiKey || apiKeyDraft;
      if (!key) {
        setShowApiKeyInput(true);
        return;
      }
      await runScan(dataUrl, key);
    };
    reader.readAsDataURL(file);
  }, [apiKey, apiKeyDraft]);

  const runScan = useCallback(async (dataUrl: string, key: string) => {
    setStep('scanning');
    setError('');
    try {
      const { base64, mediaType } = parseDataUrl(dataUrl);
      const result = await scanPaperForm(base64, mediaType, key);
      // Save to calibration storage for later correction/few-shot use
      addScanExample(dataUrl, result, result.playerName || undefined);
      setScanned(result);
      setEditPitches(result.pitches);
      setEditPitchCount(result.pitchCount.toString());
      setEditStrikes(result.strikes?.toString() ?? '');
      setEditMaxVelo(result.maxVelocity?.toString() ?? '');
      setEditFocus(result.focus ?? '');
      setEditNotes(result.notes ?? '');
      setEditEventType(result.eventType ?? 'Bullpen');
      // Auto-select pitcher if name matches
      if (result.playerName) {
        const nameLower = result.playerName.toLowerCase();
        const match = pitchers.find(p => p.name.toLowerCase().includes(nameLower) || nameLower.includes(p.name.toLowerCase()));
        if (match) setSelectedPitcherId(match.id);
      }
      setStep('review');
    } catch (err) {
      console.error('[PaperFormScanner] scan error:', err);
      let message = 'Failed to scan form';
      if (err instanceof Error) {
        message = err.message;
        // Append status code if present (Anthropic API errors)
        const status = (err as { status?: number }).status;
        if (status) message = `${message} (HTTP ${status})`;
      }
      setError(message);
      setStep('error');
    }
  }, [pitchers]);

  const handleSaveApiKey = useCallback(async () => {
    const key = apiKeyDraft.trim();
    if (!key.startsWith('sk-ant-')) {
      toast({ title: 'Invalid API key', description: 'Anthropic API keys start with sk-ant-', variant: 'destructive' });
      return;
    }
    saveApiKey(key);
    setApiKey(key);
    setShowApiKeyInput(false);
    if (imageDataUrl) {
      await runScan(imageDataUrl, key);
    }
  }, [apiKeyDraft, imageDataUrl, runScan, toast]);

  const handleSave = useCallback(async () => {
    if (!scanned || !selectedPitcherId) {
      toast({ title: 'Select a pitcher', variant: 'destructive' });
      return;
    }
    const pitcher = pitchers.find(p => p.id === selectedPitcherId);
    if (!pitcher) return;

    setSaving(true);
    try {
      const pitchCount = parseInt(editPitchCount) || scanned.pitchCount;
      const strikes = editStrikes ? parseInt(editStrikes) : null;
      const maxVelocity = editMaxVelo ? parseInt(editMaxVelo) : 0;

      const outingData: Omit<Outing, 'id' | 'timestamp'> = {
        date: editDate,
        pitcherName: pitcher.name,
        eventType: editEventType,
        pitchCount,
        strikes,
        maxVelo: maxVelocity,
        notes: editNotes,
        focus: editFocus,
        coachNotes: '',
      };

      const pitchLocations = editPitches.map(p => ({
        pitchNumber: p.pitchNumber,
        pitchType: pitchLabelToNumber(p.pitchType, pitchTypes),
        xLocation: p.xLocation,
        yLocation: p.yLocation,
        isStrike: computeIsStrike(p.xLocation, p.yLocation),
      }));

      await onSave(outingData, selectedPitcherId, pitchLocations);
      toast({ title: 'Outing saved', description: `${pitchCount} pitches imported for ${pitcher.name}` });
      handleClose();
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [scanned, editPitches, selectedPitcherId, pitchers, editPitchCount, editStrikes, editMaxVelo, editFocus, editNotes, editDate, editEventType, pitchTypes, onSave, handleClose, toast]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Scan Paper Form
          </DialogTitle>
        </DialogHeader>

        {/* ── API Key Setup ──────────────────────────────────── */}
        {showApiKeyInput && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Enter your Anthropic API key to scan paper forms. It's stored locally on your device. Get one at console.anthropic.com/settings/keys.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="sk-ant-..."
                value={apiKeyDraft}
                onChange={e => setApiKeyDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
              />
              <Button onClick={handleSaveApiKey} disabled={!apiKeyDraft.trim()}>
                <Key className="w-4 h-4 mr-1" /> Save
              </Button>
            </div>
            {apiKey && (
              <Button variant="ghost" size="sm" onClick={() => setShowApiKeyInput(false)}>
                Cancel
              </Button>
            )}
          </div>
        )}

        {/* ── Capture Step ───────────────────────────────────── */}
        {step === 'capture' && !showApiKeyInput && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Take a photo of the paper pitch chart. Claude will read the pitch locations, counts, velocity, and notes.
            </p>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </Button>
              {/* Allow picking from library too */}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="form-library-input"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById('form-library-input')?.click()}
              >
                Choose from Library
              </Button>
            </div>

            {apiKey && (
              <button
                className="text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setShowApiKeyInput(true)}
              >
                Change API key
              </button>
            )}
          </div>
        )}

        {/* ── Scanning Step ──────────────────────────────────── */}
        {step === 'scanning' && (
          <div className="flex flex-col items-center gap-4 py-8">
            {imageDataUrl && (
              <img src={imageDataUrl} alt="Form preview" className="w-full max-h-48 object-contain rounded-lg border" />
            )}
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Claude is reading your pitch chart…</p>
          </div>
        )}

        {/* ── Error Step ─────────────────────────────────────── */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-center text-destructive">{error}</p>
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Try Again
            </Button>
          </div>
        )}

        {/* ── Review Step ────────────────────────────────────── */}
        {step === 'review' && scanned && (
          <div className="space-y-4 py-2">
            {/* Thumbnail */}
            {imageDataUrl && (
              <img src={imageDataUrl} alt="Scanned form" className="w-full max-h-32 object-contain rounded-lg border" />
            )}

            {/* Interactive pitch location editor */}
            {imageDataUrl && editPitches.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {editPitches.length} pitch{editPitches.length !== 1 ? 'es' : ''} detected — tap a dot to select it, then drag or tap to move it
                </p>
                <CalibrationPitchPlot
                  imageDataUrl={imageDataUrl}
                  pitches={editPitches}
                  onChange={setEditPitches}
                  pitchTypes={pitchTypes}
                />
              </div>
            )}

            {editPitches.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                No pitch locations found — only totals will be saved.
              </p>
            )}

            {/* Pitcher + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Pitcher</Label>
                <Select value={selectedPitcherId} onValueChange={setSelectedPitcherId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {pitchers.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" className="h-9 text-sm" value={editDate} onChange={e => setEditDate(e.target.value)} />
              </div>
            </div>

            {/* Event type */}
            <div className="space-y-1">
              <Label className="text-xs">Session Type</Label>
              <Select value={editEventType} onValueChange={v => setEditEventType(v as Outing['eventType'])}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['Bullpen', 'Game', 'External', 'Live ABs'] as const).map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Pitches</Label>
                <Input className="h-9 text-sm" type="number" value={editPitchCount} onChange={e => setEditPitchCount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Strikes</Label>
                <Input className="h-9 text-sm" type="number" placeholder="—" value={editStrikes} onChange={e => setEditStrikes(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Velo</Label>
                <Input className="h-9 text-sm" type="number" placeholder="—" value={editMaxVelo} onChange={e => setEditMaxVelo(e.target.value)} />
              </div>
            </div>

            {/* Focus */}
            <div className="space-y-1">
              <Label className="text-xs">Focus for Today</Label>
              <Input className="h-9 text-sm" placeholder="Focus…" value={editFocus} onChange={e => setEditFocus(e.target.value)} />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea className="text-sm min-h-16" placeholder="Notes…" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
            </div>

            {/* Pitch list summary */}
            {editPitches.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  View pitch list ({editPitches.length} pitches)
                </summary>
                <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pl-2">
                  {editPitches.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="w-6 text-right font-mono">#{p.pitchNumber}</span>
                      <span
                        className="px-1.5 py-0.5 rounded text-white text-[10px] font-medium"
                        style={{ backgroundColor: PITCH_TYPE_COLORS[pitchLabelToNumber(p.pitchType, pitchTypes).toString()] }}
                      >
                        {p.pitchType}
                      </span>
                      <span>{p.isStrike ? '✓ Strike' : '✗ Ball'}</span>
                      {p.velocity && <span>{p.velocity} mph</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────── */}
        {step === 'review' && (
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Rescan
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !selectedPitcherId}
              className="gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save Outing
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
