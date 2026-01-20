import { useState, useEffect } from 'react';
import { Outing } from '@/types/pitcher';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    strikes: 0,
    maxVelo: 0,
    notes: '',
    videoUrl: '',
    focus: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when outing changes
  useEffect(() => {
    if (outing) {
      setFormData({
        date: outing.date,
        eventType: outing.eventType,
        pitchCount: outing.pitchCount,
        strikes: outing.strikes,
        maxVelo: outing.maxVelo,
        notes: outing.notes || '',
        videoUrl: outing.videoUrl || '',
        focus: outing.focus || '',
      });
    }
  }, [outing]);

  const handleSave = async () => {
    if (!outing) return;
    setIsSaving(true);
    const success = await onSave(outing.id, formData);
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
            <Label htmlFor="edit-date">Date</Label>
            <Input
              id="edit-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            />
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
                <SelectItem value="Live ABs">Live ABs</SelectItem>
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
                value={formData.strikes}
                onChange={(e) => setFormData((prev) => ({ ...prev, strikes: parseInt(e.target.value) || 0 }))}
              />
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
            <Label htmlFor="edit-videoUrl">Video URL</Label>
            <Input
              id="edit-videoUrl"
              type="url"
              placeholder="https://..."
              value={formData.videoUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))}
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
