import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { startOfWeek, format, addDays } from 'date-fns';
import { validateWorkoutAssignment, validateWorkoutCompletion } from '@/lib/validation';


export interface WorkoutAssignment {
  id: string;
  pitcherId: string;
  title: string;
  description: string | null;
  frequency: number; // times per week (1-7)
  attachmentUrl: string | null;
  expiresAt: string | null;
  requiresPhoto: boolean;
  isCatchUp: boolean;
  doublePoints: boolean;
  createdAt: string;
}

export interface WorkoutCompletion {
  id: string;
  assignmentId: string;
  pitcherId: string;
  weekStart: string;
  dayOfWeek: number; // 0=Mon, 6=Sun
  notes: string | null;
  photoUrl: string | null;
  createdAt: string;
}

// Get the Monday of the current week
export function getCurrentWeekStart(): string {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 }); // 1 = Monday
  return format(monday, 'yyyy-MM-dd');
}

// Get the Monday (yyyy-MM-dd) for an arbitrary date
export function getWeekStartFor(date: Date): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
}

// Get day labels for a specific week (defaults to current week).
// Accepts either a Date or a yyyy-MM-dd string representing the week's Monday.
export function getWeekDayLabels(weekStart?: string | Date): { label: string; date: Date }[] {
  let monday: Date;
  if (!weekStart) {
    monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  } else if (typeof weekStart === 'string') {
    // Parse yyyy-MM-dd as local date to avoid timezone shifts
    const [y, m, d] = weekStart.split('-').map(Number);
    monday = new Date(y, m - 1, d);
  } else {
    monday = startOfWeek(weekStart, { weekStartsOn: 1 });
  }
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => ({
    label,
    date: addDays(monday, i),
  }));
}

export function useWorkouts(pitcherId?: string) {
  const [assignments, setAssignments] = useState<WorkoutAssignment[]>([]);
  const [completions, setCompletions] = useState<WorkoutCompletion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(getCurrentWeekStart());
  const { toast } = useToast();

  // Fetch assignments for a pitcher
  const fetchAssignments = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase.rpc('get_public_pitcher_workout_assignments', { p_pitcher_id: id });

      if (error) throw error;

      const mapped: WorkoutAssignment[] = (data || []).map((row) => ({
        id: row.id,
        pitcherId: row.pitcher_id,
        title: row.title,
        description: row.description,
        frequency: row.frequency ?? 7,
        attachmentUrl: row.attachment_url ?? null,
        expiresAt: (row as any).expires_at ?? null,
        requiresPhoto: (row as any).requires_photo ?? false,
        isCatchUp: (row as any).is_catch_up ?? false,
        doublePoints: (row as any).double_points ?? false,
        createdAt: row.created_at,
      })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setAssignments(mapped);
      return mapped;
    } catch (error) {
      logger.error('Error fetching workout assignments:', error);
      return [];
    }
  }, []);

  // Fetch completions for a pitcher for a given week (defaults to current week)
  const fetchCompletions = useCallback(async (id: string, weekStartOverride?: string) => {
    const weekStart = weekStartOverride ?? getCurrentWeekStart();

    try {
      const { data, error } = await supabase.rpc('get_public_pitcher_workout_completions', { p_pitcher_id: id });

      if (error) throw error;

      const mapped: WorkoutCompletion[] = (data || [])
        .filter((row) => row.week_start === weekStart)
        .map((row) => ({
          id: row.id,
          assignmentId: row.assignment_id,
          pitcherId: row.pitcher_id,
          weekStart: row.week_start,
          dayOfWeek: row.day_of_week,
          notes: row.notes,
          photoUrl: (row as any).photo_url ?? null,
          createdAt: row.created_at,
        }));

      setCompletions(mapped);
      return mapped;
    } catch (error) {
      logger.error('Error fetching workout completions:', error);
      return [];
    }
  }, []);

  // Add a workout assignment (coach function)
  const addAssignment = useCallback(async (
    pitcherId: string,
    title: string,
    description?: string,
    frequency?: number,
    attachmentUrl?: string,
    expiresAt?: string | null,
    requiresPhoto?: boolean,
    isCatchUp?: boolean,
    doublePoints?: boolean,
  ): Promise<WorkoutAssignment | null> => {
    try {
      const validation = validateWorkoutAssignment({
        title,
        description: description ?? null,
        frequency: frequency ?? 7,
        attachmentUrl: attachmentUrl || null,
      });
      if ('error' in validation) {
        toast({
          title: 'Invalid workout',
          description: validation.error,
          variant: 'destructive',
        });
        return null;
      }

      const { data: { user } } = await supabase.auth.getUser();


      const { data, error } = await supabase
        .from('workout_assignments')
        .insert({
          pitcher_id: pitcherId,
          title,
          description: description || null,
          frequency: frequency ?? 7,
          attachment_url: attachmentUrl || null,
          expires_at: expiresAt || null,
          requires_photo: requiresPhoto ?? false,
          is_catch_up: isCatchUp ?? false,
          double_points: doublePoints ?? false,
          user_id: user?.id || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const newAssignment: WorkoutAssignment = {
        id: data.id,
        pitcherId: data.pitcher_id,
        title: data.title,
        description: data.description,
        frequency: data.frequency ?? 7,
        attachmentUrl: data.attachment_url ?? null,
        expiresAt: (data as any).expires_at ?? null,
        requiresPhoto: (data as any).requires_photo ?? false,
        isCatchUp: (data as any).is_catch_up ?? false,
        doublePoints: (data as any).double_points ?? false,
        createdAt: data.created_at,
      };

      setAssignments((prev) => [newAssignment, ...prev]);
      toast({
        title: 'Workout assigned',
        description: `"${title}" has been assigned.`,
      });
      return newAssignment;
    } catch (error) {
      logger.error('Error adding workout assignment:', error);
      toast({
        title: 'Error assigning workout',
        description: 'Could not save the workout assignment.',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  // Update a workout assignment
  const updateAssignment = useCallback(async (
    id: string,
    updates: { title?: string; description?: string | null; frequency?: number; attachmentUrl?: string | null; expiresAt?: string | null; requiresPhoto?: boolean; isCatchUp?: boolean; doublePoints?: boolean }
  ): Promise<boolean> => {
    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
      if (updates.attachmentUrl !== undefined) dbUpdates.attachment_url = updates.attachmentUrl;
      if (updates.expiresAt !== undefined) dbUpdates.expires_at = updates.expiresAt;
      if (updates.requiresPhoto !== undefined) dbUpdates.requires_photo = updates.requiresPhoto;
      if (updates.isCatchUp !== undefined) dbUpdates.is_catch_up = updates.isCatchUp;
      if (updates.doublePoints !== undefined) dbUpdates.double_points = updates.doublePoints;

      const { error } = await supabase
        .from('workout_assignments')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setAssignments((prev) =>
        prev.map((a) => a.id === id ? {
          ...a,
          ...(updates.title !== undefined && { title: updates.title }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.frequency !== undefined && { frequency: updates.frequency }),
          ...(updates.attachmentUrl !== undefined && { attachmentUrl: updates.attachmentUrl }),
          ...(updates.expiresAt !== undefined && { expiresAt: updates.expiresAt }),
          ...(updates.requiresPhoto !== undefined && { requiresPhoto: updates.requiresPhoto }),
          ...(updates.isCatchUp !== undefined && { isCatchUp: updates.isCatchUp }),
          ...(updates.doublePoints !== undefined && { doublePoints: updates.doublePoints }),
        } : a)
      );
      toast({
        title: 'Workout updated',
        description: 'The workout assignment has been updated.',
      });
      return true;
    } catch (error) {
      logger.error('Error updating workout assignment:', error);
      toast({
        title: 'Error updating workout',
        description: 'Could not update the workout.',
        variant: 'destructive',
      });
      return false;
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
      logger.error('Error deleting workout assignment:', error);
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
    const completionCheck = validateWorkoutCompletion({ dayOfWeek, notes: notes ?? null });
    if ('error' in completionCheck) {
      toast({
        title: 'Invalid entry',
        description: completionCheck.error,
        variant: 'destructive',
      });
      return false;
    }
    const weekStart = selectedWeekStart;


    // Check if already completed in the active week
    const existing = completions.find(
      (c) => c.assignmentId === assignmentId && c.dayOfWeek === dayOfWeek && c.weekStart === weekStart
    );

    try {
      if (existing) {
        // Remove completion
        const { error } = await supabase.rpc('unmark_workout_complete', {
          p_completion_id: existing.id,
          p_pitcher_id: pitcherId,
        });

        if (error) throw error;

        setCompletions((prev) => prev.filter((c) => c.id !== existing.id));
      } else {
        // Add completion
        const { data, error } = await supabase.rpc('mark_workout_complete', {
          p_assignment_id: assignmentId,
          p_pitcher_id: pitcherId,
          p_week_start: weekStart,
          p_day_of_week: dayOfWeek,
          p_notes: notes || null,
        });

        if (error) throw error;
        const row = data?.[0];
        if (!row) throw new Error('No completion row returned');

        const newCompletion: WorkoutCompletion = {
          id: row.id,
          assignmentId: row.assignment_id,
          pitcherId: row.pitcher_id,
          weekStart: row.week_start,
          dayOfWeek: row.day_of_week,
          notes: row.notes,
          photoUrl: (row as any).photo_url ?? null,
          createdAt: row.created_at,
        };

        setCompletions((prev) => [...prev, newCompletion]);
      }
      return true;
    } catch (error) {
      logger.error('Error toggling workout completion:', error);
      return false;
    }
  }, [completions, selectedWeekStart, toast]);

  // Update completion notes
  const updateCompletionNotes = useCallback(async (
    completionId: string,
    notes: string
  ): Promise<boolean> => {
    if (!pitcherId) return false;
    const noteCheck = validateWorkoutCompletion({ dayOfWeek: 0, notes });
    if ('error' in noteCheck) {
      toast({ title: 'Invalid note', description: noteCheck.error, variant: 'destructive' });
      return false;
    }
    try {

      const { error } = await supabase.rpc('update_workout_completion_notes', {
        p_completion_id: completionId, p_pitcher_id: pitcherId, p_notes: notes,
      });

      if (error) throw error;

      setCompletions((prev) =>
        prev.map((c) => (c.id === completionId ? { ...c, notes } : c))
      );
      return true;
    } catch (error) {
      logger.error('Error updating completion notes:', error);
      return false;
    }
  }, [pitcherId]);

  // Compress an image to max 1024px on either dimension, output as JPEG
  const compressImage = useCallback((file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 1920;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

        const tryCompress = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // If still over 5MB and quality hasn't been reduced yet, retry at lower quality
                if (blob.size > 5 * 1024 * 1024 && quality > 0.65) {
                  tryCompress(0.65);
                  return;
                }
                resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        };
        tryCompress(0.80);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });
  }, []);

  // Upload a photo for a workout completion
  const uploadCompletionPhoto = useCallback(async (
    pitcherId: string,
    file: File
  ): Promise<string | null> => {
    try {
      const compressed = await compressImage(file);
      const path = `workouts/${pitcherId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('outing-videos')
        .upload(path, compressed, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('outing-videos')
        .getPublicUrl(path);

      return urlData.publicUrl;
    } catch (error) {
      logger.error('Error uploading workout photo:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload the photo.',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast, compressImage]);

  // Update photo URL on a completion record
  const updateCompletionPhoto = useCallback(async (
    completionId: string,
    photoUrl: string | null
  ): Promise<boolean> => {
    if (!pitcherId) return false;
    try {
      const { error } = await supabase.rpc('update_workout_completion_photo', {
        p_completion_id: completionId, p_pitcher_id: pitcherId, p_photo_url: photoUrl,
      });

      if (error) throw error;

      setCompletions((prev) =>
        prev.map((c) => (c.id === completionId ? { ...c, photoUrl } : c))
      );
      return true;
    } catch (error) {
      logger.error('Error updating completion photo:', error);
      return false;
    }
  }, [pitcherId]);

  // Load assignments + initial-week completions on mount / pitcher change
  useEffect(() => {
    if (pitcherId) {
      setIsLoading(true);
      Promise.all([
        fetchAssignments(pitcherId),
        fetchCompletions(pitcherId, selectedWeekStart),
      ]).finally(() => setIsLoading(false));
    }
    // selectedWeekStart intentionally omitted — week changes are handled by the next effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitcherId, fetchAssignments, fetchCompletions]);

  // Refetch completions whenever the selected week changes
  useEffect(() => {
    if (pitcherId) {
      fetchCompletions(pitcherId, selectedWeekStart);
    }
  }, [pitcherId, selectedWeekStart, fetchCompletions]);

  return {
    assignments,
    completions,
    isLoading,
    selectedWeekStart,
    setSelectedWeekStart,
    addAssignment,
    updateAssignment,
    deleteAssignment,
    toggleCompletion,
    updateCompletionNotes,
    uploadCompletionPhoto,
    updateCompletionPhoto,
    refetchAssignments: fetchAssignments,
    refetchCompletions: fetchCompletions,
  };
}
