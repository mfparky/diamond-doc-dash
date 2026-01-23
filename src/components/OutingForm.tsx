import { useState, useEffect } from 'react';
import { Outing, Pitcher } from '@/types/pitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PitchPlotter } from './PitchPlotter';
import { usePitchLocations } from '@/hooks/use-pitch-locations';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';
import { Video, Send, X, Target } from 'lucide-react';

interface PlottedPitch {
  pitchNumber: number;
  pitchType: number;
  xLocation: number;
  yLocation: number;
  isStrike: boolean;
}

interface OutingFormProps {
  pitchers: Pitcher[];
  onSubmit: (outing: Omit<Outing, 'id' | 'timestamp'>, pitchLocations?: PlottedPitch[]) => void;
  onCancel?: () => void;
}

export function OutingForm({ pitchers, onSubmit, onCancel }: OutingFormProps) {
  const [formData, setFormData] = useState({
    pitcherName: '',
    date: new Date().toISOString().split('T')[0],
    eventType: '' as Outing['eventType'] | '',
    pitchCount: '',
    strikes: '',
    strikesNotTracked: false,
    maxVelo: '',
    notes: '',
    videoUrl: '',
    focus: '',
  });
  const [showPitchPlotter, setShowPitchPlotter] = useState(false);
  const [plottedPitches, setPlottedPitches] = useState<PlottedPitch[]>([]);
  const [pitchTypes, setPitchTypes] = useState<PitchTypeConfig>(DEFAULT_PITCH_TYPES);
  const { fetchPitchTypes } = usePitchLocations();

  // Load pitch types when pitcher is selected
  useEffect(() => {
    if (formData.pitcherName) {
      const selectedPitcher = pitchers.find(p => p.name === formData.pitcherName);
      if (selectedPitcher) {
        fetchPitchTypes(selectedPitcher.id).then(setPitchTypes);
      }
    }
  }, [formData.pitcherName, pitchers, fetchPitchTypes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.pitcherName || !formData.eventType || !formData.pitchCount) {
      return;
    }

    onSubmit({
      pitcherName: formData.pitcherName,
      date: formData.date,
      eventType: formData.eventType as Outing['eventType'],
      pitchCount: parseInt(formData.pitchCount) || 0,
      strikes: formData.strikesNotTracked ? null : (parseInt(formData.strikes) || 0),
      maxVelo: parseInt(formData.maxVelo) || 0,
      notes: formData.notes,
      videoUrl: formData.videoUrl,
      focus: formData.focus || undefined,
    }, plottedPitches.length > 0 ? plottedPitches : undefined);

    // Reset form
    setFormData({
      pitcherName: '',
      date: new Date().toISOString().split('T')[0],
      eventType: '',
      pitchCount: '',
      strikes: '',
      strikesNotTracked: false,
      maxVelo: '',
      notes: '',
      videoUrl: '',
      focus: '',
    });
    setPlottedPitches([]);
    setShowPitchPlotter(false);
  };

  const handlePlotterSave = (pitches: PlottedPitch[]) => {
    setPlottedPitches(pitches);
    setShowPitchPlotter(false);
  };

  // Show pitch plotter if user wants to plot
  if (showPitchPlotter) {
    return (
      <PitchPlotter
        pitchTypes={pitchTypes}
        onSave={handlePlotterSave}
        onCancel={() => setShowPitchPlotter(false)}
      />
    );
  }

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-xl text-foreground">Log Outing</CardTitle>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pitcher Selection */}
          <div className="space-y-2">
            <Label htmlFor="pitcher" className="text-sm font-medium">Pitcher</Label>
            <Select
              value={formData.pitcherName}
              onValueChange={(value) => setFormData(prev => ({ ...prev, pitcherName: value }))}
            >
              <SelectTrigger className="mobile-input">
                <SelectValue placeholder="Select pitcher" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {pitchers.map((pitcher) => (
                  <SelectItem key={pitcher.id} value={pitcher.name}>
                    {pitcher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-medium">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="mobile-input"
            />
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label htmlFor="eventType" className="text-sm font-medium">Event Type</Label>
            <Select
              value={formData.eventType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, eventType: value as Outing['eventType'] }))}
            >
              <SelectTrigger className="mobile-input">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="Bullpen">Bullpen</SelectItem>
                <SelectItem value="External">External</SelectItem>
                <SelectItem value="Game">Game</SelectItem>
                <SelectItem value="Practice">Practice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pitch Count & Strikes Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pitchCount" className="text-sm font-medium">Pitch Count</Label>
              <Input
                id="pitchCount"
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={formData.pitchCount}
                onChange={(e) => setFormData(prev => ({ ...prev, pitchCount: e.target.value }))}
                className="mobile-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="strikes" className="text-sm font-medium">Strikes</Label>
              <Input
                id="strikes"
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={formData.strikes}
                onChange={(e) => setFormData(prev => ({ ...prev, strikes: e.target.value }))}
                className="mobile-input"
                disabled={formData.strikesNotTracked}
              />
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="strikesNotTracked"
                  checked={formData.strikesNotTracked}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ 
                      ...prev, 
                      strikesNotTracked: checked === true,
                      strikes: checked === true ? '' : prev.strikes
                    }))
                  }
                />
                <Label htmlFor="strikesNotTracked" className="text-xs text-muted-foreground cursor-pointer">
                  Not tracked
                </Label>
              </div>
            </div>
          </div>

          {/* Max Velo */}
          <div className="space-y-2">
            <Label htmlFor="maxVelo" className="text-sm font-medium">Max Velo (mph)</Label>
            <Input
              id="maxVelo"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={formData.maxVelo}
              onChange={(e) => setFormData(prev => ({ ...prev, maxVelo: e.target.value }))}
              className="mobile-input"
            />
          </div>

          {/* Focus */}
          <div className="space-y-2">
            <Label htmlFor="focus" className="text-sm font-medium">
              Focus (mechanical cue - optional)
            </Label>
            <Input
              id="focus"
              type="text"
              placeholder="e.g., Stay tall, drive through..."
              value={formData.focus}
              onChange={(e) => setFormData(prev => ({ ...prev, focus: e.target.value }))}
              className="mobile-input"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Session notes..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="min-h-[80px] text-base"
            />
          </div>

          {/* Video URL */}
          <div className="space-y-2">
            <Label htmlFor="videoUrl" className="text-sm font-medium flex items-center gap-2">
              <Video className="w-4 h-4 text-accent" />
              Video Link (optional)
            </Label>
            <Input
              id="videoUrl"
              type="url"
              placeholder="https://..."
              value={formData.videoUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
              className="mobile-input"
            />
          </div>

          {/* Plot Pitch Locations Button */}
          {formData.pitcherName && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowPitchPlotter(true)}
              >
                <Target className="w-4 h-4 mr-2" />
                {plottedPitches.length > 0 
                  ? `${plottedPitches.length} Pitches Plotted ✓` 
                  : 'Plot Pitch Locations (optional)'}
              </Button>
            </div>
          )}

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={!formData.pitcherName || !formData.eventType || !formData.pitchCount}
          >
            <Send className="w-4 h-4 mr-2" />
            Log Outing
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
