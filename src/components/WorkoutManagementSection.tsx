import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ClipboardCheck, Paperclip, ExternalLink, Pencil, Clock, Camera } from 'lucide-react';
import { WorkoutAssignment } from '@/hooks/use-workouts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface WorkoutManagementSectionProps {
  pitcherId: string;
  pitcherName: string;
  assignments: WorkoutAssignment[];
  onAddAssignment: (pitcherId: string, title: string, description?: string, frequency?: number, attachmentUrl?: string, expiresAt?: string | null, requiresPhoto?: boolean) => Promise<WorkoutAssignment | null>;
  onUpdateAssignment: (id: string, updates: { title?: string; description?: string | null; frequency?: number; attachmentUrl?: string | null; expiresAt?: string | null; requiresPhoto?: boolean }) => Promise<boolean>;
  onDeleteAssignment: (id: string) => Promise<boolean>;
}

export function WorkoutManagementSection({
  pitcherId,
  pitcherName,
  assignments,
  onAddAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
}: WorkoutManagementSectionProps) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('7');
  const [expiresDate, setExpiresDate] = useState('');
  const [expiresTime, setExpiresTime] = useState('23:59');
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);

    try {
      let attachmentUrl: string | undefined;

      // Upload file if provided
      if (attachmentFile) {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('Please sign in again before uploading attachments.');
        }

        const ext = attachmentFile.name.split('.').pop() || 'file';
        const path = `${user.id}/workouts/${pitcherId}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('outing-videos')
          .upload(path, attachmentFile);

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('outing-videos')
          .getPublicUrl(path);
        attachmentUrl = urlData.publicUrl;
      }

      const expiresAt = expiresDate ? new Date(`${expiresDate}T${expiresTime || '23:59'}`).toISOString() : null;

      const result = await onAddAssignment(
        pitcherId,
        title.trim(),
        description.trim() || undefined,
        parseInt(frequency),
        attachmentUrl,
        expiresAt,
        requiresPhoto
      );
      if (result) {
        setTitle('');
        setDescription('');
        setFrequency('7');
        setExpiresDate('');
        setExpiresTime('23:59');
        setAttachmentFile(null);
        setRequiresPhoto(false);
        setIsAdding(false);
      }
    } catch (err) {
      console.error('Error adding workout:', err);
      toast({
        title: 'Could not add workout',
        description: err instanceof Error ? err.message : 'Attachment upload failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (assignment: WorkoutAssignment) => {
    setEditingId(assignment.id);
    setTitle(assignment.title);
    setDescription(assignment.description || '');
    setFrequency(String(assignment.frequency));
    setRequiresPhoto(assignment.requiresPhoto);
    if (assignment.expiresAt) {
      const d = new Date(assignment.expiresAt);
      setExpiresDate(format(d, 'yyyy-MM-dd'));
      setExpiresTime(format(d, 'HH:mm'));
    } else {
      setExpiresDate('');
      setExpiresTime('23:59');
    }
    setAttachmentFile(null);
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setFrequency('7');
    setExpiresDate('');
    setExpiresTime('23:59');
    setRequiresPhoto(false);
    setAttachmentFile(null);
  };

  const handleEdit = async () => {
    if (!editingId || !title.trim()) return;
    setIsSubmitting(true);

    try {
      let attachmentUrl: string | null | undefined;

      if (attachmentFile) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Please sign in again before uploading attachments.');

        const ext = attachmentFile.name.split('.').pop() || 'file';
        const path = `${user.id}/workouts/${pitcherId}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('outing-videos')
          .upload(path, attachmentFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('outing-videos')
          .getPublicUrl(path);
        attachmentUrl = urlData.publicUrl;
      }

      const expiresAt = expiresDate ? new Date(`${expiresDate}T${expiresTime || '23:59'}`).toISOString() : null;

      const updates: { title?: string; description?: string | null; frequency?: number; attachmentUrl?: string | null; expiresAt?: string | null; requiresPhoto?: boolean } = {
        title: title.trim(),
        description: description.trim() || null,
        frequency: parseInt(frequency),
        expiresAt,
        requiresPhoto,
      };
      if (attachmentUrl !== undefined) {
        updates.attachmentUrl = attachmentUrl;
      }

      const success = await onUpdateAssignment(editingId, updates);
      if (success) {
        cancelEdit();
      }
    } catch (err) {
      console.error('Error updating workout:', err);
      toast({
        title: 'Could not update workout',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await onDeleteAssignment(deleteId);
    setDeleteId(null);
  };

  const assignmentToDelete = assignments.find((a) => a.id === deleteId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardCheck className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-medium text-foreground">Assigned Workouts</h4>
      </div>

      {assignments.length === 0 && !isAdding && (
        <p className="text-sm text-muted-foreground">No workouts assigned yet.</p>
      )}

      {/* Existing assignments */}
      {assignments.map((assignment) => (
        editingId === assignment.id ? (
          <div key={assignment.id} className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
            <div>
              <Label className="text-xs">Workout Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Band Work, Arm Care Routine"
                className="h-8 mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details about the workout..."
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs">Frequency (days per week)</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x per week
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Expiration (optional)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="date"
                  value={expiresDate}
                  onChange={(e) => setExpiresDate(e.target.value)}
                  className="h-8 text-xs flex-1"
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
                <Input
                  type="time"
                  value={expiresTime}
                  onChange={(e) => setExpiresTime(e.target.value)}
                  className="h-8 text-xs w-28"
                  disabled={!expiresDate}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Replace Attachment (optional)</Label>
              <Input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                className="h-8 mt-1 text-xs"
              />
              {assignment.attachmentUrl && !attachmentFile && (
                <p className="text-xs text-muted-foreground mt-1">Current attachment will be kept</p>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requiresPhoto}
                onChange={(e) => setRequiresPhoto(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="text-xs flex items-center gap-1">
                <Camera className="w-3 h-3" />
                Require photo to complete
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEdit}
                disabled={!title.trim() || isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
        <div
          key={assignment.id}
          className="flex items-start gap-2 p-2 rounded-md bg-background/50 border border-border/30"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground truncate">{assignment.title}</p>
              <span className="text-xs text-muted-foreground shrink-0">{assignment.frequency}x/wk</span>
              {assignment.requiresPhoto && (
                <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-0.5" title="Requires photo">
                  <Camera className="w-3 h-3" />
                </span>
              )}
              {assignment.expiresAt && (
                <span className={`text-xs shrink-0 flex items-center gap-0.5 ${new Date(assignment.expiresAt) < new Date() ? 'text-status-danger' : 'text-amber-500'}`}>
                  <Clock className="w-3 h-3" />
                  {new Date(assignment.expiresAt) < new Date() ? 'Expired' : `Due ${format(new Date(assignment.expiresAt), 'MMM d, h:mm a')}`}
                </span>
              )}
            </div>
            {assignment.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{assignment.description}</p>
            )}
            {assignment.attachmentUrl && (
              <a
                href={assignment.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <Paperclip className="w-3 h-3" />
                View attachment
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => startEdit(assignment)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteId(assignment.id)}
            className="h-7 w-7 text-status-danger hover:text-status-danger shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        )
      ))}

      {/* Add new assignment form */}
      {isAdding ? (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
          <div>
            <Label className="text-xs">Workout Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Band Work, Arm Care Routine"
              className="h-8 mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details about the workout..."
              className="mt-1"
              rows={2}
            />
          </div>
          <div>
            <Label className="text-xs">Frequency (days per week)</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="h-8 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}x per week
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Expiration (optional)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="date"
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
                className="h-8 text-xs flex-1"
                min={format(new Date(), 'yyyy-MM-dd')}
              />
              <Input
                type="time"
                value={expiresTime}
                onChange={(e) => setExpiresTime(e.target.value)}
                className="h-8 text-xs w-28"
                disabled={!expiresDate}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Attachment (optional)</Label>
            <Input
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              className="h-8 mt-1 text-xs"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requiresPhoto}
              onChange={(e) => setRequiresPhoto(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            <span className="text-xs flex items-center gap-1">
              <Camera className="w-3 h-3" />
              Require photo to complete
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setTitle('');
                setDescription('');
                setFrequency('7');
                setExpiresDate('');
                setExpiresTime('23:59');
                setAttachmentFile(null);
                setRequiresPhoto(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!title.trim() || isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Workout
        </Button>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Workout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{assignmentToDelete?.title}"? 
              This will also remove all completion records for this workout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-status-danger hover:bg-status-danger/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
