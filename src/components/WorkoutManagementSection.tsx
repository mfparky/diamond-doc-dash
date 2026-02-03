import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ClipboardCheck } from 'lucide-react';
import { WorkoutAssignment } from '@/hooks/use-workouts';
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
  onAddAssignment: (pitcherId: string, title: string, description?: string) => Promise<WorkoutAssignment | null>;
  onDeleteAssignment: (id: string) => Promise<boolean>;
}

export function WorkoutManagementSection({
  pitcherId,
  pitcherName,
  assignments,
  onAddAssignment,
  onDeleteAssignment,
}: WorkoutManagementSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    const result = await onAddAssignment(pitcherId, title.trim(), description.trim() || undefined);
    if (result) {
      setTitle('');
      setDescription('');
      setIsAdding(false);
    }
    setIsSubmitting(false);
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
        <div
          key={assignment.id}
          className="flex items-start gap-2 p-2 rounded-md bg-background/50 border border-border/30"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{assignment.title}</p>
            {assignment.description && (
              <p className="text-xs text-muted-foreground truncate">{assignment.description}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteId(assignment.id)}
            className="h-7 w-7 text-status-danger hover:text-status-danger shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
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
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setTitle('');
                setDescription('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!title.trim() || isSubmitting}
            >
              Add
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
