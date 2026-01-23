import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { usePitchLocations } from '@/hooks/use-pitch-locations';

interface PitchTypeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pitcherId: string;
  pitcherName: string;
}

export function PitchTypeConfigDialog({
  open,
  onOpenChange,
  pitcherId,
  pitcherName,
}: PitchTypeConfigDialogProps) {
  const [pitchTypes, setPitchTypes] = useState<PitchTypeConfig>(DEFAULT_PITCH_TYPES);
  const [isSaving, setIsSaving] = useState(false);
  const { fetchPitchTypes, updatePitchTypes } = usePitchLocations();

  // Load pitch types when dialog opens
  useEffect(() => {
    if (open && pitcherId) {
      fetchPitchTypes(pitcherId).then((types) => {
        setPitchTypes(types);
      });
    }
  }, [open, pitcherId, fetchPitchTypes]);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updatePitchTypes(pitcherId, pitchTypes);
    setIsSaving(false);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setPitchTypes((prev) => ({
      ...prev,
      [key]: value.toUpperCase().slice(0, 4),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Pitch Types - {pitcherName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Configure the pitch type labels for this pitcher. These will be used when plotting strike locations.
          </p>

          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((num) => (
              <div key={num} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full border border-white/30 shrink-0"
                  style={{ backgroundColor: PITCH_TYPE_COLORS[num.toString()] }}
                />
                <Label className="w-8 text-muted-foreground">{num}:</Label>
                <Input
                  value={pitchTypes[num.toString()] || ''}
                  onChange={(e) => handleChange(num.toString(), e.target.value)}
                  placeholder={DEFAULT_PITCH_TYPES[num.toString()]}
                  className="flex-1"
                  maxLength={4}
                />
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Common abbreviations: FB (Fastball), CB (Curveball), CH (Changeup), SL (Slider), CT (Cutter), 2S (2-Seam), KN (Knuckle)
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
