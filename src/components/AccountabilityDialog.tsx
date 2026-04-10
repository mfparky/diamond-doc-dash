import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, Check, MessageSquare, Trophy, Paperclip, ExternalLink, Camera, X, Loader2 } from 'lucide-react';
import { TeamLeaderboardDialog } from '@/components/TeamLeaderboardDialog';
import { WorkoutGalleryDialog } from '@/components/WorkoutGalleryDialog';
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
  onUploadPhoto?: (pitcherId: string, file: File) => Promise<string | null>;
  onUpdatePhoto?: (completionId: string, photoUrl: string | null) => Promise<boolean>;
  achievementStart?: Date;
  achievementEnd?: Date;
}

export function AccountabilityDialog({
  open,
  onOpenChange,
  assignments,
  completions,
  pitcherId,
  onToggleDay,
  onUpdateNotes,
  onUploadPhoto,
  onUpdatePhoto,
  achievementStart,
  achievementEnd,
}: AccountabilityDialogProps) {
  const weekDays = getWeekDayLabels();
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<{ assignmentId: string; dayOfWeek: number } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryPhotoCount, setGalleryPhotoCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { count } = await supabase
        .from('workout_completions')
        .select('*', { count: 'exact', head: true })
        .eq('pitcher_id', pitcherId)
        .not('photo_url', 'is', null);
      if (count !== null) setGalleryPhotoCount(count);
    })();
  }, [open, pitcherId]);

  const isCompleted = (assignmentId: string, dayOfWeek: number): boolean => {
    return completions.some(
      (c) => c.assignmentId === assignmentId && c.dayOfWeek === dayOfWeek
    );
  };

  const getCompletion = (assignmentId: string, dayOfWeek: number): WorkoutCompletion | undefined => {
    return completions.find(
      (c) => c.assignmentId === assignmentId && c.dayOfWeek === dayOfWeek
    );
  };

  const getCompletedCount = (assignmentId: string): number => {
    return completions.filter((c) => c.assignmentId === assignmentId).length;
  };

  const isAtFrequencyCap = (assignmentId: string, frequency: number): boolean => {
    return getCompletedCount(assignmentId) >= frequency;
  };

  const handleToggle = async (assignmentId: string, dayOfWeek: number, frequency: number) => {
    const key = `${assignmentId}-${dayOfWeek}`;
    if (pendingToggles.has(key)) return;

    const alreadyCompleted = isCompleted(assignmentId, dayOfWeek);
    if (!alreadyCompleted && isAtFrequencyCap(assignmentId, frequency)) return;

    setPendingToggles((prev) => new Set(prev).add(key));
    await onToggleDay(assignmentId, dayOfWeek);
    setPendingToggles((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleOpenNotes = (assignmentId: string, dayOfWeek: number) => {
    const completion = getCompletion(assignmentId, dayOfWeek);
    setNoteText(completion?.notes || '');
    setEditingNotes({ assignmentId, dayOfWeek });
  };

  const handleSaveNotes = async () => {
    if (!editingNotes || !onUpdateNotes) return;
    const completion = getCompletion(editingNotes.assignmentId, editingNotes.dayOfWeek);
    if (completion) {
      await onUpdateNotes(completion.id, noteText);
    }
    setEditingNotes(null);
    setNoteText('');
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingNotes || !onUploadPhoto || !onUpdatePhoto) return;

    const completion = getCompletion(editingNotes.assignmentId, editingNotes.dayOfWeek);
    if (!completion) return;

    setIsUploading(true);
    const url = await onUploadPhoto(pitcherId, file);
    if (url) {
      await onUpdatePhoto(completion.id, url);
    }
    setIsUploading(false);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = async () => {
    if (!editingNotes || !onUpdatePhoto) return;
    const completion = getCompletion(editingNotes.assignmentId, editingNotes.dayOfWeek);
    if (completion) {
      await onUpdatePhoto(completion.id, null);
    }
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  };

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

  const editingCompletion = editingNotes
    ? getCompletion(editingNotes.assignmentId, editingNotes.dayOfWeek)
    : null;

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
            {achievementStart && (
              <span className="block mt-1 text-primary font-medium">
                {format(achievementStart, 'MMM d')} – {achievementEnd ? format(achievementEnd, 'MMM d') : 'Present'}
              </span>
            )}
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{assignment.title}</h3>
                    {assignment.requiresPhoto && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground border border-border/50 rounded px-1.5 py-0.5">
                        <Camera className="w-3 h-3" />
                        Photo required
                      </span>
                    )}
                  </div>
                  {assignment.description && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{assignment.description}</p>
                  )}
                  {assignment.attachmentUrl && (
                    <a
                      href={assignment.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      <Paperclip className="w-3 h-3" />
                      View workout details
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-xs text-primary">
                      {completedDays}/{assignment.frequency ?? 7}x this week (max)
                    </p>
                    {assignment.expiresAt && new Date(assignment.expiresAt) < new Date() && (
                      <span className="text-xs text-destructive font-medium">Expired</span>
                    )}
                    {assignment.expiresAt && new Date(assignment.expiresAt) >= new Date() && (
                      <span className="text-xs text-amber-500">Due {format(new Date(assignment.expiresAt), 'MMM d, h:mm a')}</span>
                    )}
                  </div>
                </div>

                {/* Day checkboxes */}
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map(({ label, date }, dayIndex) => {
                    const completed = isCompleted(assignment.id, dayIndex);
                    const completion = getCompletion(assignment.id, dayIndex);
                    const isPending = pendingToggles.has(`${assignment.id}-${dayIndex}`);
                    const today = isToday(date);

                    const atCap = !completed && isAtFrequencyCap(assignment.id, assignment.frequency ?? 7);
                    const isExpired = !!assignment.expiresAt && new Date(assignment.expiresAt) < new Date();
                    const disabled = isPending || atCap || (isExpired && !completed);

                    return (
                      <div key={dayIndex} className="flex flex-col items-center gap-1">
                        <span className={`text-xs font-medium ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                          {label}
                        </span>
                        <button
                          onClick={() => !disabled && handleToggle(assignment.id, dayIndex, assignment.frequency ?? 7)}
                          disabled={disabled}
                          className={`
                            w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all
                            ${completed
                              ? 'bg-primary border-primary text-primary-foreground'
                              : disabled
                                ? 'bg-muted/30 border-border/30 cursor-not-allowed opacity-40'
                                : 'bg-background border-border hover:border-primary/50'
                            }
                            ${isPending ? 'opacity-50' : ''}
                            ${today && !completed && !atCap ? 'ring-2 ring-primary/30' : ''}
                          `}
                        >
                          {completed && <Check className="w-5 h-5" />}
                        </button>
                        {/* Notes/photo indicator */}
                        {completed && (
                          <button
                            onClick={() => handleOpenNotes(assignment.id, dayIndex)}
                            className={`p-1.5 -m-1 flex items-center justify-center gap-0.5 rounded-md ${
                              completion?.notes || completion?.photoUrl ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                          >
                            <MessageSquare className="w-4 h-4" />
                            {completion?.photoUrl && <Camera className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Inline notes + photo editing for this assignment */}
                {editingNotes && editingNotes.assignmentId === assignment.id && (
                  <div className="border-t border-border/50 pt-3 mt-3 space-y-3">
                    <Label className="text-sm font-medium">
                      Notes for {weekDays[editingNotes.dayOfWeek]?.label}
                    </Label>
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="How did the workout go? Any feedback?"
                      rows={3}
                    />

                    {/* Photo section */}
                    {onUploadPhoto && onUpdatePhoto && (
                      <div>
                        {editingCompletion?.photoUrl ? (
                          <div className="relative inline-block">
                            <a href={editingCompletion.photoUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={editingCompletion.photoUrl}
                                alt="Workout photo"
                                className="w-24 h-24 object-cover rounded-lg border border-border"
                              />
                            </a>
                            <button
                              onClick={handleRemovePhoto}
                              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/heic"
                              className="hidden"
                              onChange={handlePhotoSelect}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                            >
                              {isUploading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Camera className="w-4 h-4" />
                              )}
                              {isUploading ? 'Uploading...' : 'Add Photo'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingNotes(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveNotes}>
                        Save Note
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Team Leaderboard & Gallery Links */}
        <div className="border-t border-border pt-4 space-y-2">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setShowLeaderboard(true)}
          >
            <Trophy className="w-4 h-4" />
            View Team Leaderboard
          </Button>

          {galleryPhotoCount >= 10 && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowGallery(true)}
            >
              <Camera className="w-4 h-4" />
              Workout Wall
              <span className="ml-auto text-xs text-muted-foreground">{galleryPhotoCount} photos</span>
            </Button>
          )}
        </div>

      </DialogContent>

      <TeamLeaderboardDialog
        open={showLeaderboard}
        onOpenChange={setShowLeaderboard}
        pitcherId={pitcherId}
      />

      <WorkoutGalleryDialog
        open={showGallery}
        onOpenChange={setShowGallery}
        pitcherId={pitcherId}
        title="Workout Wall"
      />
    </Dialog>
  );
}
