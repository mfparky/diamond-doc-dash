import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { startOfWeek, format, addDays } from 'date-fns';

export interface WorkoutAssignment {
  id: string;
  pitcherId: string;
  title: string;
  description: string | null;
  createdAt: string;
}

export interface WorkoutCompletion {
  id: string;
  assignmentId: string;
  pitcherId: string;
  weekStart: string;
  dayOfWeek: number; // 0=Mon, 6=Sun
  notes: string | null;
  createdAt: string;
}

// Get the Monday of the current week
export function getCurrentWeekStart(): string {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 }); // 1 = Monday
  return format(monday, 'yyyy-MM-dd');
}

// Get day labels for current week
export function getWeekDayLabels(): { label: string; date: Date }[] {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => ({
    label,
    date: addDays(monday, i),
  }));
}

export function useWorkouts(pitcherId?: string) {
  const [assignments, setAssignments] = useState<WorkoutAssignment[]>([]);
  const [completions, setCompletions] = useState<WorkoutCompletion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch assignments for a pitcher
  const fetchAssignments = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('workout_assignments')
        .select('*')
        .eq('pitcher_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: WorkoutAssignment[] = (data || []).map((row) => ({
        id: row.id,
        pitcherId: row.pitcher_id,
        title: row.title,
        description: row.description,
        createdAt: row.created_at,
      }));

      setAssignments(mapped);
      return mapped;
    } catch (error) {
      console.error('Error fetching workout assignments:', error);
      return [];
    }
  }, []);

  // Fetch completions for a pitcher for current week
  const fetchCompletions = useCallback(async (id: string) => {
    const weekStart = getCurrentWeekStart();
    
    try {
      const { data, error } = await supabase
        .from('workout_completions')
        .select('*')
        .eq('pitcher_id', id)
        .eq('week_start', weekStart);

      if (error) throw error;

      const mapped: WorkoutCompletion[] = (data || []).map((row) => ({
        id: row.id,
        assignmentId: row.assignment_id,
        pitcherId: row.pitcher_id,
        weekStart: row.week_start,
        dayOfWeek: row.day_of_week,
        notes: row.notes,
        createdAt: row.created_at,
      }));

      setCompletions(mapped);
      return mapped;
    } catch (error) {
      console.error('Error fetching workout completions:', error);
      return [];
    }
  }, []);

  // Add a workout assignment (coach function)
  const addAssignment = useCallback(async (
    pitcherId: string,
    title: string,
    description?: string
  ): Promise<WorkoutAssignment | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('workout_assignments')
        .insert({
          pitcher_id: pitcherId,
          title,
          description: description || null,
          user_id: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newAssignment: WorkoutAssignment = {
        id: data.id,
        pitcherId: data.pitcher_id,
        title: data.title,
        description: data.description,
        createdAt: data.created_at,
      };

      setAssignments((prev) => [newAssignment, ...prev]);
      toast({
        title: 'Workout assigned',
        description: `"${title}" has been assigned.`,
      });
      return newAssignment;
    } catch (error) {
      console.error('Error adding workout assignment:', error);
      toast({
        title: 'Error assigning workout',
        description: 'Could not save the workout assignment.',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  // Delete a workout assignment
  const deleteAssignment = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('workout_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAssignments((prev) => prev.filter((a) => a.id !== id));
      toast({
        title: 'Workout removed',
        description: 'The workout assignment has been removed.',
      });
      return true;
    } catch (error) {
      console.error('Error deleting workout assignment:', error);
      toast({
        title: 'Error removing workout',
        description: 'Could not remove the workout.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Toggle a completion for a day (parent function)
  const toggleCompletion = useCallback(async (
    assignmentId: string,
    pitcherId: string,
    dayOfWeek: number,
    notes?: string
  ): Promise<boolean> => {
    const weekStart = getCurrentWeekStart();
    
    // Check if already completed
    const existing = completions.find(
      (c) => c.assignmentId === assignmentId && c.dayOfWeek === dayOfWeek
    );

    try {
      if (existing) {
        // Remove completion
        const { error } = await supabase
          .from('workout_completions')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;

        setCompletions((prev) => prev.filter((c) => c.id !== existing.id));
      } else {
        // Add completion
        const { data, error } = await supabase
          .from('workout_completions')
          .insert({
            assignment_id: assignmentId,
            pitcher_id: pitcherId,
            week_start: weekStart,
            day_of_week: dayOfWeek,
            notes: notes || null,
          })
          .select()
          .single();

        if (error) throw error;

        const newCompletion: WorkoutCompletion = {
          id: data.id,
          assignmentId: data.assignment_id,
          pitcherId: data.pitcher_id,
          weekStart: data.week_start,
          dayOfWeek: data.day_of_week,
          notes: data.notes,
          createdAt: data.created_at,
        };

        setCompletions((prev) => [...prev, newCompletion]);
      }
      return true;
    } catch (error) {
      console.error('Error toggling workout completion:', error);
      return false;
    }
  }, [completions]);

  // Update completion notes
  const updateCompletionNotes = useCallback(async (
    completionId: string,
    notes: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('workout_completions')
        .update({ notes })
        .eq('id', completionId);

      if (error) throw error;

      setCompletions((prev) =>
        prev.map((c) => (c.id === completionId ? { ...c, notes } : c))
      );
      return true;
    } catch (error) {
      console.error('Error updating completion notes:', error);
      return false;
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    if (pitcherId) {
      setIsLoading(true);
      Promise.all([
        fetchAssignments(pitcherId),
        fetchCompletions(pitcherId),
      ]).finally(() => setIsLoading(false));
    }
  }, [pitcherId, fetchAssignments, fetchCompletions]);

  return {
    assignments,
    completions,
    isLoading,
    addAssignment,
    deleteAssignment,
    toggleCompletion,
    updateCompletionNotes,
    refetchAssignments: fetchAssignments,
    refetchCompletions: fetchCompletions,
  };
}
