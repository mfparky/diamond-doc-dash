import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Outing } from '@/types/pitcher';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PitchLocation } from '@/types/pitch-location';
import { PitchPlotter } from './PitchPlotter';
import { StrikeZone } from './StrikeZone';
import { usePitchLocations } from '@/hooks/use-pitch-locations';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Plus, MapPin } from 'lucide-react';
import { parseLiveAbsData, AB_OUTCOME_COLOR, abPitchRange } from '@/types/at-bats';
import { PITCH_TYPE_COLORS } from '@/types/pitch-location';

interface OutingPitchMapDialogProps {
  outing: Outing | null;
  pitcherId: string;
  pitchTypes?: PitchTypeConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPitchMapUpdated?: () => void;
}

export function OutingPitchMapDialog({
  outing,
  pitcherId,
  pitchTypes = DEFAULT_PITCH_TYPES,
  open,
  onOpenChange,
  onPitchMapUpdated,
}: OutingPitchMapDialogProps) {
  const [existingLocations, setExistingLocations] = useState<PitchLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPlotter, setShowPlotter] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const { fetchPitchLocationsForOuting, addPitchLocations, deletePitchLocationsForOuting } = usePitchLocations();
  const { toast } = useToast();

  // Load existing pitch locations when dialog opens
  useEffect(() => {
    if (open && outing) {
      setIsLoading(true);
      fetchPitchLocationsForOuting(outing.id)
        .then(setExistingLocations)
        .finally(() => setIsLoading(false));
    } else {
      setExistingLocations([]);
      setShowPlotter(false);
    }
  }, [open, outing, fetchPitchLocationsForOuting]);

  const handleSavePitches = useCallback(async (pitches: Array<{
    pitchNumber: number;
    pitchType: number;
    xLocation: number;
    yLocation: number;
    isStrike: boolean;
  }>) => {
    if (!outing) return;

    setIsLoading(true);
    const success = await addPitchLocations(outing.id, pitcherId, pitches);
    
    if (success) {
      toast({
        title: 'Pitch map saved',
        description: `${pitches.length} pitches recorded for this outing.`,
      });
      // Reload the locations
      const updated = await fetchPitchLocationsForOuting(outing.id);
      setExistingLocations(updated);
      setShowPlotter(false);
      onPitchMapUpdated?.();
    }
    setIsLoading(false);
  }, [outing, pitcherId, addPitchLocations, fetchPitchLocationsForOuting, toast, onPitchMapUpdated]);

  const handleClearPitchMap = useCallback(async () => {
    if (!outing) return;

    setIsLoading(true);
    const success = await deletePitchLocationsForOuting(outing.id);
    
    if (success) {
      toast({
        title: 'Pitch map cleared',
        description: 'All pitch locations have been removed from this outing.',
      });
      setExistingLocations([]);
      onPitchMapUpdated?.();
    } else {
      toast({
        title: 'Error',
        description: 'Could not clear pitch map. Please try again.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
    setShowClearConfirm(false);
  }, [outing, deletePitchLocationsForOuting, toast, onPitchMapUpdated]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (!outing) return null;

  const hasPitchMap = existingLocations.length > 0;
  const strikeCount = existingLocations.filter(p => p.isStrike).length;
  const strikePercent = hasPitchMap ? ((strikeCount / existingLocations.length) * 100).toFixed(0) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              Pitch Map - {formatDate(outing.date)}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : showPlotter ? (
            <PitchPlotter
              pitchTypes={pitchTypes}
              onSave={handleSavePitches}
              onCancel={() => setShowPlotter(false)}
            />
          ) : hasPitchMap ? (
            <div className="space-y-4">
              <div className="flex justify-center py-4">
                <StrikeZone
                  pitchLocations={existingLocations}
                  pitchTypes={pitchTypes}
                  size="md"
                  showLegend
                />
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{existingLocations.length}</span> pitches plotted
                <span className="mx-2">•</span>
                <span className="font-medium text-foreground">{strikeCount}</span> strikes ({strikePercent}%)
              </div>

              {/* At-bat breakdown for Live ABs */}
              {outing.eventType === 'Live ABs' && (() => {
                const liveData = parseLiveAbsData(outing.notes);
                if (!liveData || liveData.atBats.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">At-Bat Breakdown</p>
                    <div className="space-y-1.5">
                      {liveData.atBats.map((ab, abIdx) => {
                        const [start, end] = abPitchRange(liveData.atBats, abIdx);
                        const abPitches = existingLocations.filter(
                          p => p.pitchNumber >= start && p.pitchNumber <= end
                        );
                        const abStrikes = abPitches.filter(p => p.isStrike).length;
                        return (
                          <div key={ab.ab} className="flex items-center gap-2 bg-secondary/30 rounded px-2 py-1.5">
                            <span className="text-xs text-muted-foreground w-10 shrink-0">AB #{ab.ab}</span>
                            {ab.outcome && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: AB_OUTCOME_COLOR[ab.outcome] + '33',
                                  color: AB_OUTCOME_COLOR[ab.outcome],
                                }}
                              >
                                {ab.outcome}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {abPitches.length}p · {abStrikes}K
                            </span>
                            <div className="flex gap-0.5 flex-wrap">
                              {abPitches.map((p, i) => (
                                <div
                                  key={i}
                                  className="w-2.5 h-2.5 rounded-full border border-white/20"
                                  style={{ backgroundColor: PITCH_TYPE_COLORS[p.pitchType.toString()] }}
                                  title={`#${p.pitchNumber} ${p.isStrike ? 'Strike' : 'Ball'}`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {liveData.text && (
                      <p className="text-xs text-muted-foreground italic">{liveData.text}</p>
                    )}
                  </div>
                );
              })()}

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Pitch Map
                </Button>
                <Button onClick={() => {
                  // Clear existing and start fresh
                  setShowClearConfirm(true);
                }}>
                  Re-Plot Pitches
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-8">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                  <MapPin className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-2">No Pitch Map</h3>
                <p className="text-sm text-muted-foreground">
                  This outing doesn't have pitch locations recorded yet.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setShowPlotter(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pitch Map
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Pitch Map?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {existingLocations.length} pitch locations from this outing. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearPitchMap}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Pitch Map
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
