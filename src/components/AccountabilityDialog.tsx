import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, Check, MessageSquare, Trophy } from 'lucide-react';
import { TeamLeaderboardDialog } from '@/components/TeamLeaderboardDialog';
import { WorkoutAssignment, WorkoutCompletion, getWeekDayLabels } from '@/hooks/use-workouts';
import { format } from 'date-fns';

interface AccountabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: WorkoutAssignment[];
  completions: WorkoutCompletion[];
  pitcherId: string;
  onToggleDay: (assignmentId: string, dayOfWeek: number) => Promise<boolean>;
  onUpdateNotes?: (completionId: string, notes: string) => Promise<boolean>;
}

export function AccountabilityDialog({
  open,
  onOpenChange,
  assignments,
  completions,
  pitcherId,
  onToggleDay,
  onUpdateNotes,
}: AccountabilityDialogProps) {
  const weekDays = getWeekDayLabels();
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<{ assignmentId: string; dayOfWeek: number } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Check if a day is completed for an assignment
  const isCompleted = (assignmentId: string, dayOfWeek: number): boolean => {
    return completions.some(
      (c) => c.assignmentId === assignmentId && c.dayOfWeek === dayOfWeek
    );
  };

  // Get completion for a specific assignment and day
  const getCompletion = (assignmentId: string, dayOfWeek: number): WorkoutCompletion | undefined => {
    return completions.find(
      (c) => c.assignmentId === assignmentId && c.dayOfWeek === dayOfWeek
    );
  };

  // Handle day toggle
  const handleToggle = async (assignmentId: string, dayOfWeek: number) => {
    const key = `${assignmentId}-${dayOfWeek}`;
    if (pendingToggles.has(key)) return;

    setPendingToggles((prev) => new Set(prev).add(key));
    await onToggleDay(assignmentId, dayOfWeek);
    setPendingToggles((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // Open notes editor
  const handleOpenNotes = (assignmentId: string, dayOfWeek: number) => {
    const completion = getCompletion(assignmentId, dayOfWeek);
    setNoteText(completion?.notes || '');
    setEditingNotes({ assignmentId, dayOfWeek });
  };

  // Save notes
  const handleSaveNotes = async () => {
    if (!editingNotes || !onUpdateNotes) return;
    const completion = getCompletion(editingNotes.assignmentId, editingNotes.dayOfWeek);
    if (completion) {
      await onUpdateNotes(completion.id, noteText);
    }
    setEditingNotes(null);
    setNoteText('');
  };

  // Check if today is the current day
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  };

  // Check if day is in the future
  const isFuture = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };

  if (assignments.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              Accountability
            </DialogTitle>
            <DialogDescription>
              No workouts have been assigned yet.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-8 text-muted-foreground">
            <p>Check back later for assigned workouts!</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Accountability
          </DialogTitle>
          <DialogDescription>
            Mark the days when workouts were completed this week.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {assignments.map((assignment) => {
            const completedDays = completions.filter(
              (c) => c.assignmentId === assignment.id
            ).length;

            return (
              <div
                key={assignment.id}
                className="p-4 rounded-lg bg-secondary/50 border border-border/50"
              >
                <div className="mb-3">
                  <h3 className="font-semibold text-foreground">{assignment.title}</h3>
                  {assignment.description && (
                    <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>
                  )}
                  <p className="text-xs text-primary mt-2">
                    {completedDays}/7 days completed
                  </p>
                </div>

                {/* Day checkboxes */}
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map(({ label, date }, dayIndex) => {
                    const completed = isCompleted(assignment.id, dayIndex);
                    const completion = getCompletion(assignment.id, dayIndex);
                    const isPending = pendingToggles.has(`${assignment.id}-${dayIndex}`);
                    const future = isFuture(date);
                    const today = isToday(date);

                    return (
                      <div key={dayIndex} className="flex flex-col items-center gap-1">
                        <span className={`text-xs font-medium ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                          {label}
                        </span>
                        <button
                          onClick={() => !future && handleToggle(assignment.id, dayIndex)}
                          disabled={isPending || future}
                          className={`
                            w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all
                            ${completed
                              ? 'bg-primary border-primary text-primary-foreground'
                              : future
                                ? 'bg-muted/30 border-border/30 cursor-not-allowed'
                                : 'bg-background border-border hover:border-primary/50'
                            }
                            ${isPending ? 'opacity-50' : ''}
                            ${today && !completed ? 'ring-2 ring-primary/30' : ''}
                          `}
                        >
                          {completed && <Check className="w-5 h-5" />}
                        </button>
                        {/* Notes indicator */}
                        {completed && (
                          <button
                            onClick={() => handleOpenNotes(assignment.id, dayIndex)}
                            className={`p-1.5 -m-1 flex items-center justify-center rounded-md ${
                              completion?.notes ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Notes editing dialog */}
        {editingNotes && (
          <div className="border-t border-border pt-4 mt-4">
            <Label className="text-sm font-medium">Add notes for this day</Label>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="How did the workout go? Any feedback?"
              className="mt-2"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setEditingNotes(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveNotes}>
                Save Note
              </Button>
            </div>
          </div>
        )}

        {/* Team Leaderboard Link */}
        <div className="border-t border-border pt-4">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setShowLeaderboard(true)}
          >
            <Trophy className="w-4 h-4" />
            View Team Leaderboard
          </Button>
        </div>
      </DialogContent>

      <TeamLeaderboardDialog
        open={showLeaderboard}
        onOpenChange={setShowLeaderboard}
        pitcherId={pitcherId}
      />
    </Dialog>
  );
}
