import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ClipboardCheck, Check, MessageSquare, Paperclip, ExternalLink, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, format, addDays, differenceInHours } from 'date-fns';

interface WorkoutCompletionDisplayProps {
  pitcherId: string;
}

interface WorkoutAssignment {
  id: string;
  title: string;
  description: string | null;
  frequency: number;
  attachmentUrl: string | null;
  expiresAt: string | null;
}

interface WorkoutCompletion {
  id: string;
  assignmentId: string;
  dayOfWeek: number;
  notes: string | null;
  photoUrl: string | null;
  createdAt: string;
}

function getCurrentWeekStart(): string {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
}

function getWeekDayLabels(): { label: string; date: Date }[] {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => ({
    label,
    date: addDays(monday, i),
  }));
}

export function WorkoutCompletionDisplay({ pitcherId }: WorkoutCompletionDisplayProps) {
  const [assignments, setAssignments] = useState<WorkoutAssignment[]>([]);
  const [completions, setCompletions] = useState<WorkoutCompletion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!pitcherId) return;
      setIsLoading(true);
      const weekStart = getCurrentWeekStart();

      try {
        const [assignmentsRes, completionsRes] = await Promise.all([
          supabase
            .from('workout_assignments')
            .select('id, title, description, frequency, attachment_url')
            .eq('pitcher_id', pitcherId),
          supabase
            .from('workout_completions')
            .select('id, assignment_id, day_of_week, notes, photo_url, created_at')
            .eq('pitcher_id', pitcherId)
            .eq('week_start', weekStart),
        ]);

        if (assignmentsRes.error) throw assignmentsRes.error;
        if (completionsRes.error) throw completionsRes.error;

        setAssignments(
          (assignmentsRes.data || []).map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            frequency: (a as any).frequency ?? 7,
            attachmentUrl: (a as any).attachment_url ?? null,
            expiresAt: (a as any).expires_at ?? null,
          }))
        );

        setCompletions(
          (completionsRes.data || []).map((c) => ({
            id: c.id,
            assignmentId: c.assignment_id,
            dayOfWeek: c.day_of_week,
            notes: c.notes,
            photoUrl: (c as any).photo_url ?? null,
            createdAt: c.created_at,
          }))
        );
      } catch (error) {
        console.error('Error fetching workout data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [pitcherId]);

  const weekDays = getWeekDayLabels();

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

  const isRecent = (createdAt: string): boolean => {
    return differenceInHours(new Date(), new Date(createdAt)) <= 48;
  };

  // Count recent completions for external use
  const recentCount = completions.filter((c) => isRecent(c.createdAt)).length;

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="animate-pulse text-muted-foreground text-sm">Loading workouts...</div>
        </CardContent>
      </Card>
    );
  }

  // Separate active vs expired assignments — expired ones still count in tally but are hidden from UI
  const activeAssignments = assignments.filter((a) => !a.expiresAt || new Date(a.expiresAt) >= new Date());

  if (activeAssignments.length === 0 && completions.length === 0) {
    return null;
  }

  const totalPossible = activeAssignments.reduce((sum, a) => sum + (a.frequency ?? 7), 0);
  const totalCompleted = completions.length;
  const completionRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          Weekly Accountability
          {recentCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5">
              {recentCount}
            </span>
          )}
          <span className="text-sm font-normal text-muted-foreground ml-auto">
            {completionRate}% complete
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeAssignments.map((assignment) => {
          const completedDays = completions.filter(
            (c) => c.assignmentId === assignment.id
          ).length;

          return (
            <div key={assignment.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-foreground">{assignment.title}</p>
                  {assignment.description && (
                    <p className="text-xs text-muted-foreground">{assignment.description}</p>
                  )}
                  {assignment.attachmentUrl && (
                    <a
                      href={assignment.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                    >
                      <Paperclip className="w-3 h-3" />
                      View details
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <span className="text-xs font-medium text-primary">{completedDays}/{assignment.frequency ?? 7}</span>
              </div>

              {/* Day grid */}
              <div className="flex gap-1">
                {weekDays.map(({ label, date }, dayIndex) => {
                  const completed = isCompleted(assignment.id, dayIndex);
                  const completion = getCompletion(assignment.id, dayIndex);
                  const hasDetail = completed && (completion?.notes || completion?.photoUrl);
                  const recent = completed && completion && isRecent(completion.createdAt);

                  const dayCell = (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                      <div
                        className={`
                          w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium relative
                          ${completed
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground'
                          }
                          ${hasDetail ? 'cursor-pointer ring-1 ring-primary/40' : ''}
                        `}
                      >
                        {completed ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="opacity-30">-</span>
                        )}
                        {recent && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent animate-pulse border border-background" />
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 h-3">
                        {completed && completion?.notes && (
                          <MessageSquare className="w-3 h-3 text-primary/60" />
                        )}
                        {completed && completion?.photoUrl && (
                          <Camera className="w-3 h-3 text-primary/60" />
                        )}
                      </div>
                    </div>
                  );

                  if (!hasDetail) {
                    return <div key={dayIndex}>{dayCell}</div>;
                  }

                  return (
                    <Popover key={dayIndex}>
                      <PopoverTrigger asChild>
                        {dayCell}
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3 space-y-2" side="top">
                        <p className="text-xs font-medium text-muted-foreground">
                          {assignment.title} — {format(date, 'EEE, MMM d')}
                        </p>
                        {completion?.notes && (
                          <div className="bg-muted/50 rounded p-2">
                            <p className="text-sm text-foreground">{completion.notes}</p>
                          </div>
                        )}
                        {completion?.photoUrl && (
                          <a href={completion.photoUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={completion.photoUrl}
                              alt="Workout photo"
                              className="rounded-md w-full max-h-40 object-cover border border-border hover:opacity-90 transition-opacity"
                            />
                          </a>
                        )}
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
