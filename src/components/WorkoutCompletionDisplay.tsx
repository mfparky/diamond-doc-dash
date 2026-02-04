import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardCheck, Check, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, format, addDays } from 'date-fns';

interface WorkoutCompletionDisplayProps {
  pitcherId: string;
}

interface WorkoutAssignment {
  id: string;
  title: string;
  description: string | null;
}

interface WorkoutCompletion {
  id: string;
  assignmentId: string;
  dayOfWeek: number;
  notes: string | null;
}

// Get the Monday of the current week
function getCurrentWeekStart(): string {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
}

// Get day labels for current week
function getWeekDayLabels(): string[] {
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
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
        // Fetch assignments and completions in parallel
        const [assignmentsRes, completionsRes] = await Promise.all([
          supabase
            .from('workout_assignments')
            .select('id, title, description')
            .eq('pitcher_id', pitcherId),
          supabase
            .from('workout_completions')
            .select('id, assignment_id, day_of_week, notes')
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
          }))
        );

        setCompletions(
          (completionsRes.data || []).map((c) => ({
            id: c.id,
            assignmentId: c.assignment_id,
            dayOfWeek: c.day_of_week,
            notes: c.notes,
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

  // Check if a day is completed for an assignment
  const isCompleted = (assignmentId: string, dayOfWeek: number): boolean => {
    return completions.some(
      (c) => c.assignmentId === assignmentId && c.dayOfWeek === dayOfWeek
    );
  };

  // Get completion notes
  const getCompletionNotes = (assignmentId: string, dayOfWeek: number): string | null => {
    const completion = completions.find(
      (c) => c.assignmentId === assignmentId && c.dayOfWeek === dayOfWeek
    );
    return completion?.notes ?? null;
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="animate-pulse text-muted-foreground text-sm">Loading workouts...</div>
        </CardContent>
      </Card>
    );
  }

  if (assignments.length === 0) {
    return null; // Don't show anything if no workouts assigned
  }

  // Calculate total progress
  const totalPossible = assignments.length * 7;
  const totalCompleted = completions.length;
  const completionRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          Weekly Accountability
          <span className="text-sm font-normal text-muted-foreground ml-auto">
            {completionRate}% complete
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {assignments.map((assignment) => {
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
                </div>
                <span className="text-xs font-medium text-primary">{completedDays}/7</span>
              </div>

              {/* Day grid */}
              <div className="flex gap-1">
                {weekDays.map((label, dayIndex) => {
                  const completed = isCompleted(assignment.id, dayIndex);
                  const notes = getCompletionNotes(assignment.id, dayIndex);

                  return (
                    <div key={dayIndex} className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                      <div
                        className={`
                          w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium
                          ${completed
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground'
                          }
                        `}
                        title={notes ? `Notes: ${notes}` : undefined}
                      >
                        {completed ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="opacity-30">-</span>
                        )}
                      </div>
                      {completed && notes && (
                        <MessageSquare className="w-3 h-3 text-primary/60" />
                      )}
                    </div>
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
