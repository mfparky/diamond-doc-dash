import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Video, Send, X, Target, MessageSquare } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { PitchPlotter } from './PitchPlotter';
import { usePitchLocations } from '@/hooks/use-pitch-locations';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';
import { AB_OUTCOMES, AB_OUTCOME_LABELS } from '@/types/at-bats';
import { cn } from '@/lib/utils';

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
  defaultPitcherName?: string;
}

// Helper to get today's date as YYYY-MM-DD without timezone issues
function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalNoon(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

export function OutingForm({ pitchers, onSubmit, onCancel, defaultPitcherName }: OutingFormProps) {
  const [formData, setFormData] = useState({
    pitcherName: defaultPitcherName || '',
    date: getTodayDateString(),
    eventType: '' as Outing['eventType'] | '',
    pitchCount: '',
    strikes: '',
    strikesNotTracked: false,
    maxVelo: '',
    notes: '',
    coachNotes: '',
    videoUrl1: '',
    focus: '',
    battersFaced: '',
    outcomeNotes: '',
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => toLocalNoon(new Date()));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
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

  // Update date string when calendar selection changes
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const normalized = toLocalNoon(date);
    setSelectedDate(normalized);

    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, '0');
    const day = String(normalized.getDate()).padStart(2, '0');
    setFormData((prev) => ({ ...prev, date: `${year}-${month}-${day}` }));
    setDatePickerOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const isLiveAbs = formData.eventType === 'Live ABs';
    if (!formData.pitcherName || !formData.eventType) return;
    if (!formData.pitchCount) return;

    const pitchCount = parseInt(formData.pitchCount) || 0;
    const strikes = formData.strikesNotTracked ? null : (parseInt(formData.strikes) || 0);

    // For Live ABs, encode batters faced and outcome notes in notes JSON
    let notesValue = formData.notes;
    if (isLiveAbs) {
      const liveAbsSummary: Record<string, unknown> = {};
      if (formData.battersFaced) liveAbsSummary.battersFaced = parseInt(formData.battersFaced) || 0;
      if (formData.outcomeNotes) liveAbsSummary.outcomeNotes = formData.outcomeNotes;
      if (formData.notes) liveAbsSummary.text = formData.notes;
      notesValue = Object.keys(liveAbsSummary).length > 0 ? JSON.stringify(liveAbsSummary) : formData.notes;
    }

    const pitchesToSave = plottedPitches.length > 0 ? plottedPitches : undefined;

    onSubmit({
      pitcherName: formData.pitcherName,
      date: formData.date,
      eventType: formData.eventType as Outing['eventType'],
      pitchCount,
      strikes,
      maxVelo: parseInt(formData.maxVelo) || 0,
      notes: notesValue,
      coachNotes: formData.coachNotes || undefined,
      videoUrl1: formData.videoUrl1 || undefined,
      focus: formData.focus || undefined,
    }, pitchesToSave);

    // Reset form
    const today = toLocalNoon(new Date());
    setFormData({
      pitcherName: '',
      date: getTodayDateString(),
      eventType: '',
      pitchCount: '',
      strikes: '',
      strikesNotTracked: false,
      maxVelo: '',
      notes: '',
      coachNotes: '',
      videoUrl1: '',
      focus: '',
      battersFaced: '',
      outcomeNotes: '',
    });
    setSelectedDate(today);
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
        <CardTitle className="font-display text-xl text-foreground">Log Outing</CardTitle>
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
            <Label className="text-sm font-medium">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mobile-input",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
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
                <SelectItem value="Live ABs">Live ABs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Live AB Charter — shown in place of pitch count/strikes/plotter for Live ABs */}
          {formData.eventType === 'Live ABs' && formData.pitcherName && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Chart At-Bats</Label>
              <LiveAbCharter
                pitchTypes={pitchTypes}
                onChange={setLiveAbData}
                initialData={liveAbData}
              />
              {liveAbData.pitches.length > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {liveAbData.pitches.length} pitches · {liveAbData.pitches.filter(p => p.isStrike).length} strikes
                  {liveAbData.atBats.length > 0 && ` · ${liveAbData.atBats.length} ABs`}
                </p>
              )}
            </div>
          )}

          {/* Pitch Count & Strikes Row — hidden for Live ABs */}
          {formData.eventType !== 'Live ABs' && <div className="grid grid-cols-2 gap-3">
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
          </div>}

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

          {/* Coach's Notes */}
          <div className="space-y-2">
            <Label htmlFor="coachNotes" className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-500" />
              Coach's Notes (optional)
            </Label>
            <Textarea
              id="coachNotes"
              placeholder="Private coaching observations..."
              value={formData.coachNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, coachNotes: e.target.value }))}
              className="min-h-[80px] text-base"
            />
          </div>

          {/* Video URL */}
          <div className="space-y-2">
            <Label htmlFor="videoUrl1" className="text-sm font-medium flex items-center gap-2">
              <Video className="w-4 h-4 text-accent" />
              YouTube Link (optional)
            </Label>
            <Input
              id="videoUrl1"
              type="url"
              placeholder="https://youtube.com/watch?v=... or youtu.be/..."
              value={formData.videoUrl1}
              onChange={(e) => setFormData(prev => ({ ...prev, videoUrl1: e.target.value }))}
              className="mobile-input"
            />
          </div>

          {/* Plot Pitch Locations Button — only for non-Live-ABs outings */}
          {formData.pitcherName && formData.eventType !== 'Live ABs' && (
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
            disabled={!formData.pitcherName || !formData.eventType || (formData.eventType !== 'Live ABs' && !formData.pitchCount)}
          >
            <Send className="w-4 h-4 mr-2" />
            Log Outing
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
