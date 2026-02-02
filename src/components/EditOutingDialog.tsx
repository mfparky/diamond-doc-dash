import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, MessageSquare } from 'lucide-react';
import { Outing } from '@/types/pitcher';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface EditOutingDialogProps {
  outing: Outing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Partial<Omit<Outing, 'id' | 'timestamp'>>) => Promise<boolean>;
}

export function EditOutingDialog({ outing, open, onOpenChange, onSave }: EditOutingDialogProps) {
  const [formData, setFormData] = useState({
    date: '',
    eventType: 'Bullpen' as Outing['eventType'],
    pitchCount: 0,
    strikes: null as number | null,
    strikesNotTracked: false,
    maxVelo: 0,
    notes: '',
    coachNotes: '',
    videoUrl1: '',
    focus: '',
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const normalizeDateOnly = (d: Date) => {
    // DayPicker can give a Date that represents the chosen day but with a non-midnight
    // local time (common when a date-only value is interpreted as UTC).
    // Normalize to local *noon* for stable display and to avoid timezone/day shifts.
    const useUtcParts = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0 || d.getMilliseconds() !== 0;
    const year = useUtcParts ? d.getUTCFullYear() : d.getFullYear();
    const monthIndex = useUtcParts ? d.getUTCMonth() : d.getMonth();
    const day = useUtcParts ? d.getUTCDate() : d.getDate();
    return new Date(year, monthIndex, day, 12, 0, 0, 0);
  };

  // Reset form when outing changes
  useEffect(() => {
    if (outing) {
      setFormData({
        date: outing.date,
        eventType: outing.eventType,
        pitchCount: outing.pitchCount,
        strikes: outing.strikes,
        strikesNotTracked: outing.strikes === null,
        maxVelo: outing.maxVelo,
        notes: outing.notes || '',
        coachNotes: outing.coachNotes || '',
        videoUrl1: outing.videoUrl1 || outing.videoUrl || '',
        focus: outing.focus || '',
      });
      // Parse the date string as local date (not UTC)
      if (outing.date) {
        const [year, month, day] = outing.date.split('-').map(Number);
        setSelectedDate(new Date(year, month - 1, day, 12, 0, 0, 0));
      }
    }
  }, [outing]);

  // Update date string when calendar selection changes
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const normalized = normalizeDateOnly(date);
    setSelectedDate(normalized);

    // Format as YYYY-MM-DD using local date parts from the normalized date
    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, '0');
    const day = String(normalized.getDate()).padStart(2, '0');
    setFormData((prev) => ({ ...prev, date: `${year}-${month}-${day}` }));
  };

  const handleSave = async () => {
    if (!outing) return;
    setIsSaving(true);
    const { strikesNotTracked, ...dataToSave } = formData;
    const success = await onSave(outing.id, {
      ...dataToSave,
      strikes: strikesNotTracked ? null : dataToSave.strikes,
    });
    setIsSaving(false);
    if (success) {
      onOpenChange(false);
    }
  };

  if (!outing) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Outing</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
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

          <div className="space-y-2">
            <Label htmlFor="edit-eventType">Event Type</Label>
            <Select
              value={formData.eventType}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, eventType: value as Outing['eventType'] }))}
            >
              <SelectTrigger id="edit-eventType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bullpen">Bullpen</SelectItem>
                <SelectItem value="External">External</SelectItem>
                <SelectItem value="Game">Game</SelectItem>
                <SelectItem value="Practice">Practice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-pitchCount">Pitch Count</Label>
              <Input
                id="edit-pitchCount"
                type="number"
                min={0}
                value={formData.pitchCount}
                onChange={(e) => setFormData((prev) => ({ ...prev, pitchCount: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-strikes">Strikes</Label>
              <Input
                id="edit-strikes"
                type="number"
                min={0}
                value={formData.strikesNotTracked ? '' : (formData.strikes ?? '')}
                onChange={(e) => setFormData((prev) => ({ ...prev, strikes: parseInt(e.target.value) || 0 }))}
                disabled={formData.strikesNotTracked}
              />
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="edit-strikesNotTracked"
                  checked={formData.strikesNotTracked}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ 
                      ...prev, 
                      strikesNotTracked: checked === true,
                      strikes: checked === true ? null : 0
                    }))
                  }
                />
                <Label htmlFor="edit-strikesNotTracked" className="text-xs text-muted-foreground cursor-pointer">
                  Not tracked
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-maxVelo">Max Velocity</Label>
            <Input
              id="edit-maxVelo"
              type="number"
              min={0}
              value={formData.maxVelo}
              onChange={(e) => setFormData((prev) => ({ ...prev, maxVelo: parseInt(e.target.value) || 0 }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-focus">Focus</Label>
            <Input
              id="edit-focus"
              type="text"
              placeholder="Mechanical cue..."
              value={formData.focus}
              onChange={(e) => setFormData((prev) => ({ ...prev, focus: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-videoUrl1">Video URL</Label>
            <Input
              id="edit-videoUrl1"
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              value={formData.videoUrl1}
              onChange={(e) => setFormData((prev) => ({ ...prev, videoUrl1: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              placeholder="Additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-coachNotes" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-500" />
              Coach's Notes
            </Label>
            <Textarea
              id="edit-coachNotes"
              placeholder="Private coaching observations..."
              value={formData.coachNotes}
              onChange={(e) => setFormData((prev) => ({ ...prev, coachNotes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
