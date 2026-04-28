import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Trash2, Plus, Check, X, Sun, Moon, ChevronRight, ArrowLeft, Users, Palette, ClipboardCheck, Trophy, CalendarIcon, Copy, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PitcherRecord } from '@/hooks/use-pitchers';
import { WorkoutManagementSection } from '@/components/WorkoutManagementSection';
import { WorkoutLeaderboard } from '@/components/WorkoutLeaderboard';
import { useDesignSystem } from '@/contexts/DesignSystemContext';

import { useWorkouts, WorkoutAssignment } from '@/hooks/use-workouts';
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

interface RosterManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pitchers: PitcherRecord[];
  onAddPitcher: (name: string, maxWeeklyPitches: number) => Promise<PitcherRecord | null>;
  onUpdatePitcher: (id: string, updates: { name?: string; maxWeeklyPitches?: number }) => Promise<boolean>;
  onDeletePitcher: (id: string) => Promise<boolean>;
}

type SettingsView = 'menu' | 'roster' | 'workouts';

export function RosterManagementDialog({
  open,
  onOpenChange,
  pitchers,
  onAddPitcher,
  onUpdatePitcher,
  onDeletePitcher,
}: RosterManagementDialogProps) {
  const [view, setView] = useState<SettingsView>('menu');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMaxPitches, setEditMaxPitches] = useState(120);
  const [newName, setNewName] = useState('');
  const [newMaxPitches, setNewMaxPitches] = useState(120);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { mode, toggleMode } = useDesignSystem();
  const isDark = mode === 'dark';
  const [workoutAssignments, setWorkoutAssignments] = useState<Record<string, WorkoutAssignment[]>>({});
  const [achievementStartDate, setAchievementStartDate] = useState<Date | undefined>();
  const [achievementEndDate, setAchievementEndDate] = useState<Date | undefined>();
  const [leaderboardStartDate, setLeaderboardStartDate] = useState<Date | undefined>();
  const [leaderboardEndDate, setLeaderboardEndDate] = useState<Date | undefined>();
  const { toast } = useToast();

  // Fetch all workout assignments for all pitchers
  const fetchAllWorkoutAssignments = useCallback(async () => {
    if (pitchers.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('workout_assignments')
        .select('*')
        .in('pitcher_id', pitchers.map(p => p.id));

      if (error) throw error;

      const grouped: Record<string, WorkoutAssignment[]> = {};
      (data || []).forEach((row) => {
        const pitcherId = row.pitcher_id;
        if (!grouped[pitcherId]) grouped[pitcherId] = [];
        grouped[pitcherId].push({
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
        });
      });
      setWorkoutAssignments(grouped);
    } catch (error) {
      console.error('Error fetching workout assignments:', error);
    }
  }, [pitchers]);

  // Load achievement + leaderboard dates from team or owner settings when dialog opens
  useEffect(() => {
    if (!open || pitchers.length === 0) return;
    const teamId = pitchers[0]?.teamId;
    const userId = pitchers[0]?.userId;

    const loadSettings = async () => {
      if (teamId) {
        const { data } = await supabase
          .from('teams')
          .select('leaderboard_from, leaderboard_to, achievement_from, achievement_to')
          .eq('id', teamId)
          .maybeSingle();

        if (data) {
          setAchievementStartDate((data as any).achievement_from ? new Date((data as any).achievement_from + 'T00:00:00') : undefined);
          setAchievementEndDate((data as any).achievement_to ? new Date((data as any).achievement_to + 'T00:00:00') : undefined);
          setLeaderboardStartDate(data.leaderboard_from ? new Date(data.leaderboard_from + 'T00:00:00') : undefined);
          setLeaderboardEndDate(data.leaderboard_to ? new Date(data.leaderboard_to + 'T00:00:00') : undefined);
        }
        return;
      }

      if (userId) {
        const { data } = await supabase
          .from('dashboard_settings' as any)
          .select('leaderboard_from, leaderboard_to, achievement_from, achievement_to')
          .eq('user_id', userId)
          .maybeSingle();

        if (data) {
          setAchievementStartDate((data as any).achievement_from ? new Date((data as any).achievement_from + 'T00:00:00') : undefined);
          setAchievementEndDate((data as any).achievement_to ? new Date((data as any).achievement_to + 'T00:00:00') : undefined);
          setLeaderboardStartDate((data as any).leaderboard_from ? new Date((data as any).leaderboard_from + 'T00:00:00') : undefined);
          setLeaderboardEndDate((data as any).leaderboard_to ? new Date((data as any).leaderboard_to + 'T00:00:00') : undefined);
        }
      }
    };

    loadSettings();
  }, [open, pitchers]);

  useEffect(() => {
    if (open) {
      fetchAllWorkoutAssignments();
    }
  }, [open, fetchAllWorkoutAssignments]);

  // Add assignment handler
  const handleAddAssignment = async (pitcherId: string, title: string, description?: string, frequency?: number, attachmentUrl?: string, expiresAt?: string | null, requiresPhoto?: boolean, isCatchUp?: boolean, doublePoints?: boolean): Promise<WorkoutAssignment | null> => {
    const pitcher = pitchers.find((item) => item.id === pitcherId);

    if (!pitcher) {
      toast({
        title: 'Error adding workout',
        description: 'Could not find the selected player.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: 'Authentication required',
          description: 'Please sign in again before assigning workouts.',
          variant: 'destructive',
        });
        return null;
      }
      
      const { data, error } = await supabase
        .from('workout_assignments')
        .insert({
          pitcher_id: pitcherId,
          team_id: pitcher.teamId,
          title,
          description: description || null,
          frequency: frequency ?? 7,
          attachment_url: attachmentUrl || null,
          expires_at: expiresAt || null,
          requires_photo: requiresPhoto ?? false,
          is_catch_up: isCatchUp ?? false,
          double_points: doublePoints ?? false,
          user_id: pitcher.teamId ? null : user.id,
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

      setWorkoutAssignments((prev) => ({
        ...prev,
        [pitcherId]: [newAssignment, ...(prev[pitcherId] || [])],
      }));

      return newAssignment;
    } catch (error: any) {
      console.error('Error adding assignment:', error);
      const message = error?.message?.toLowerCase()?.includes('row-level security')
        ? 'You do not have permission to assign workouts for this player.'
        : 'Could not save the workout. Please try again.';

      toast({
        title: 'Error adding workout',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  };

  // Delete assignment handler
  const handleDeleteAssignment = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('workout_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setWorkoutAssignments((prev) => {
        const updated = { ...prev };
        for (const pitcherId in updated) {
          updated[pitcherId] = updated[pitcherId].filter((a) => a.id !== id);
        }
        return updated;
      });

      return true;
    } catch (error) {
      console.error('Error deleting assignment:', error);
      return false;
    }
  };

  // Update assignment handler
  const handleUpdateAssignment = async (
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

      setWorkoutAssignments((prev) => {
        const updated = { ...prev };
        for (const pitcherId in updated) {
          updated[pitcherId] = updated[pitcherId].map((a) =>
            a.id === id ? { ...a, ...updates } : a
          );
        }
        return updated;
      });

      return true;
    } catch (error) {
      console.error('Error updating assignment:', error);
      return false;
    }
  };

  // Cascade workouts from one pitcher to all others
  const handleCascadeWorkouts = async (sourcePitcherId: string) => {
    const sourceAssignments = workoutAssignments[sourcePitcherId] || [];
    if (sourceAssignments.length === 0) {
      toast({ title: 'No workouts to copy', description: 'This player has no workouts assigned.', variant: 'destructive' });
      return;
    }

    const sourcePitcher = pitchers.find(p => p.id === sourcePitcherId);
    if (!sourcePitcher) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let copiedCount = 0;
      for (const targetPitcher of pitchers) {
        if (targetPitcher.id === sourcePitcherId) continue;
        const existingTitles = new Set((workoutAssignments[targetPitcher.id] || []).map(a => a.title));

        for (const assignment of sourceAssignments) {
          if (existingTitles.has(assignment.title)) continue;
          await supabase.from('workout_assignments').insert({
            pitcher_id: targetPitcher.id,
            team_id: targetPitcher.teamId,
            title: assignment.title,
            description: assignment.description,
            frequency: assignment.frequency,
            attachment_url: assignment.attachmentUrl,
            expires_at: assignment.expiresAt,
            requires_photo: assignment.requiresPhoto,
            is_catch_up: assignment.isCatchUp,
            double_points: assignment.doublePoints,
            user_id: targetPitcher.teamId ? null : user.id,
          } as any);
          copiedCount++;
        }
      }

      await fetchAllWorkoutAssignments();
      toast({
        title: 'Workouts copied',
        description: `${copiedCount} workout${copiedCount !== 1 ? 's' : ''} copied to ${pitchers.length - 1} player${pitchers.length > 2 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error('Error cascading workouts:', error);
      toast({ title: 'Error copying workouts', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
  };

  // Cascade as a catch-up workout to players outside the leaderboard top 5
  const handleCascadeToCatchUp = async (sourcePitcherId: string) => {
    const sourceAssignments = workoutAssignments[sourcePitcherId] || [];
    if (sourceAssignments.length === 0) {
      toast({ title: 'No workouts to copy', description: 'This player has no workouts assigned.', variant: 'destructive' });
      return;
    }

    const sourcePitcher = pitchers.find(p => p.id === sourcePitcherId);
    if (!sourcePitcher) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine the leaderboard window (coach-defined dates, or default to current week)
      const now = new Date();
      const fromDate = leaderboardStartDate ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const toDate = leaderboardEndDate ?? now;

      // Get all week_starts (Mondays) within the window
      const weekStarts: string[] = [];
      const cursor = new Date(fromDate);
      // Snap to Monday
      const dayIdx = (cursor.getDay() + 6) % 7;
      cursor.setDate(cursor.getDate() - dayIdx);
      while (cursor <= toDate) {
        weekStarts.push(format(cursor, 'yyyy-MM-dd'));
        cursor.setDate(cursor.getDate() + 7);
      }

      // Pull completion counts for all team pitchers in that window
      const pitcherIds = pitchers.map(p => p.id);
      const { data: completions, error: completionsError } = await supabase
        .from('workout_completions')
        .select('pitcher_id, week_start, assignment_id')
        .in('pitcher_id', pitcherIds)
        .in('week_start', weekStarts.length > 0 ? weekStarts : ['1970-01-01']);

      if (completionsError) throw completionsError;

      // Map of assignment id → weight (double-points = 2)
      const weightById: Record<string, number> = {};
      Object.values(workoutAssignments).flat().forEach((a) => {
        weightById[a.id] = a.doublePoints ? 2 : 1;
      });

      const counts: Record<string, number> = {};
      pitcherIds.forEach(id => { counts[id] = 0; });
      (completions || []).forEach((c: any) => {
        const w = weightById[c.assignment_id] ?? 1;
        counts[c.pitcher_id] = (counts[c.pitcher_id] || 0) + w;
      });

      // Rank pitchers by completions DESC; bottom = everyone outside top 5
      const ranked = [...pitchers].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
      const bottomGroup = ranked.slice(5);

      if (bottomGroup.length === 0) {
        toast({ title: 'No catch-up players', description: 'There are no players outside the top 5 yet.' });
        return;
      }

      let copiedCount = 0;
      for (const targetPitcher of bottomGroup) {
        const existingTitles = new Set((workoutAssignments[targetPitcher.id] || []).map(a => a.title));
        for (const assignment of sourceAssignments) {
          if (existingTitles.has(assignment.title)) continue;
          await supabase.from('workout_assignments').insert({
            pitcher_id: targetPitcher.id,
            team_id: targetPitcher.teamId,
            title: assignment.title,
            description: assignment.description,
            frequency: assignment.frequency,
            attachment_url: assignment.attachmentUrl,
            expires_at: assignment.expiresAt,
            requires_photo: assignment.requiresPhoto,
            is_catch_up: true,
            double_points: assignment.doublePoints,
            user_id: targetPitcher.teamId ? null : user.id,
          } as any);
          copiedCount++;
        }
      }

      await fetchAllWorkoutAssignments();
      toast({
        title: 'Catch-up workouts assigned',
        description: `${copiedCount} workout${copiedCount !== 1 ? 's' : ''} sent to ${bottomGroup.length} player${bottomGroup.length !== 1 ? 's' : ''} outside the top 5.`,
      });
    } catch (error) {
      console.error('Error cascading catch-up workouts:', error);
      toast({ title: 'Error copying workouts', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
  };

  const toggleTheme = () => {
    toggleMode();
  };

  const handleClose = (openState: boolean) => {
    if (!openState) {
      setView('menu');
      setEditingId(null);
      setIsAdding(false);
    }
    onOpenChange(openState);
  };

  const handleStartEdit = (pitcher: PitcherRecord) => {
    setEditingId(pitcher.id);
    setEditName(pitcher.name);
    setEditMaxPitches(pitcher.maxWeeklyPitches);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditMaxPitches(120);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const success = await onUpdatePitcher(editingId, { name: editName, maxWeeklyPitches: editMaxPitches });
    if (success) {
      handleCancelEdit();
    }
  };

  const handleAddPitcher = async () => {
    if (!newName.trim()) return;
    const result = await onAddPitcher(newName, newMaxPitches);
    if (result) {
      setNewName('');
      setNewMaxPitches(120);
      setIsAdding(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    await onDeletePitcher(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleAchievementDateChange = async (date: Date | undefined) => {
    setAchievementStartDate(date);
    if (date) {
      localStorage.setItem('achievementStartDate', date.toISOString());
    } else {
      localStorage.removeItem('achievementStartDate');
    }
    window.dispatchEvent(new Event('storage'));

    const teamId = pitchers[0]?.teamId;
    const userId = pitchers[0]?.userId;
    if (teamId) {
      await supabase
        .from('teams')
        .update({ achievement_from: date ? format(date, 'yyyy-MM-dd') : null } as any)
        .eq('id', teamId);
    } else if (userId) {
      await supabase
        .from('dashboard_settings' as any)
        .upsert({ user_id: userId, achievement_from: date ? format(date, 'yyyy-MM-dd') : null }, { onConflict: 'user_id' });
    }
  };

  const handleAchievementEndDateChange = async (date: Date | undefined) => {
    setAchievementEndDate(date);
    const teamId = pitchers[0]?.teamId;
    const userId = pitchers[0]?.userId;
    if (teamId) {
      await supabase
        .from('teams')
        .update({ achievement_to: date ? format(date, 'yyyy-MM-dd') : null } as any)
        .eq('id', teamId);
    } else if (userId) {
      await supabase
        .from('dashboard_settings' as any)
        .upsert({ user_id: userId, achievement_to: date ? format(date, 'yyyy-MM-dd') : null }, { onConflict: 'user_id' });
    }
  };

  const handleLeaderboardDateChange = async (date: Date | undefined) => {
    setLeaderboardStartDate(date);
    const teamId = pitchers[0]?.teamId;
    const userId = pitchers[0]?.userId;
    if (teamId) {
      await supabase
        .from('teams')
        .update({ leaderboard_from: date ? format(date, 'yyyy-MM-dd') : null })
        .eq('id', teamId);
    } else if (userId) {
      await supabase
        .from('dashboard_settings' as any)
        .upsert({ user_id: userId, leaderboard_from: date ? format(date, 'yyyy-MM-dd') : null }, { onConflict: 'user_id' });
    }
  };

  const handleLeaderboardEndDateChange = async (date: Date | undefined) => {
    setLeaderboardEndDate(date);
    const teamId = pitchers[0]?.teamId;
    const userId = pitchers[0]?.userId;
    if (teamId) {
      await supabase
        .from('teams')
        .update({ leaderboard_to: date ? format(date, 'yyyy-MM-dd') : null })
        .eq('id', teamId);
    } else if (userId) {
      await supabase
        .from('dashboard_settings' as any)
        .upsert({ user_id: userId, leaderboard_to: date ? format(date, 'yyyy-MM-dd') : null }, { onConflict: 'user_id' });
    }
  };

  const pitcherToDelete = pitchers.find(p => p.id === deleteConfirmId);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
          {view === 'menu' ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Settings</DialogTitle>
                <DialogDescription>
                  Customize your app preferences and manage your roster.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-2 py-4">
                {/* Appearance Option */}
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border/50 hover:bg-secondary/80 transition-colors text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Palette className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Appearance</p>
                      <p className="text-sm text-muted-foreground">
                        {isDark ? 'Dark mode' : 'Light mode'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </div>
                </button>

                {/* Roster Option */}
                <button
                  onClick={() => setView('roster')}
                  className="w-full flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border/50 hover:bg-secondary/80 transition-colors text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Roster</p>
                      <p className="text-sm text-muted-foreground">
                        {pitchers.length} pitcher{pitchers.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>

                {/* Workouts Option */}
                <button
                  onClick={() => setView('workouts')}
                  className="w-full flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border/50 hover:bg-secondary/80 transition-colors text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <ClipboardCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Workouts</p>
                      <p className="text-sm text-muted-foreground">
                        Assign accountability workouts
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>

                {/* Achievement Window (per-player badges) */}
                <div className="w-full p-4 rounded-lg bg-secondary/50 border border-border/50 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Achievement Window</p>
                      <p className="text-sm text-muted-foreground">
                        {achievementStartDate && achievementEndDate
                          ? `${format(achievementStartDate, 'MMM d')} – ${format(achievementEndDate, 'MMM d, yyyy')}`
                          : achievementStartDate
                          ? `From ${format(achievementStartDate, 'MMM d, yyyy')}`
                          : 'All time (no filter)'}
                      </p>
                    </div>
                  </div>
                  <div className="pl-[52px] space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Start Date</p>
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal flex-1', !achievementStartDate && 'text-muted-foreground')}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {achievementStartDate ? format(achievementStartDate, 'PPP') : 'Pick start date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={achievementStartDate} onSelect={handleAchievementDateChange} disabled={(date) => date > new Date()} initialFocus className={cn('p-3 pointer-events-auto')} />
                        </PopoverContent>
                      </Popover>
                      {achievementStartDate && (
                        <Button variant="ghost" size="sm" onClick={() => handleAchievementDateChange(undefined)} className="text-muted-foreground"><X className="w-4 h-4" /></Button>
                      )}
                    </div>
                    {achievementStartDate && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium">End Date</p>
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal flex-1', !achievementEndDate && 'text-muted-foreground')}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {achievementEndDate ? format(achievementEndDate, 'PPP') : 'Pick end date (optional)'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={achievementEndDate} onSelect={handleAchievementEndDateChange} disabled={(date) => achievementStartDate ? date < achievementStartDate : false} initialFocus className={cn('p-3 pointer-events-auto')} />
                            </PopoverContent>
                          </Popover>
                          {achievementEndDate && (
                            <Button variant="ghost" size="sm" onClick={() => handleAchievementEndDateChange(undefined)} className="text-muted-foreground"><X className="w-4 h-4" /></Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Workout Leaderboard Window (team-wide) */}
                <div className="w-full p-4 rounded-lg bg-secondary/50 border border-border/50 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CalendarIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Workout Leaderboard Window</p>
                      <p className="text-sm text-muted-foreground">
                        {leaderboardStartDate && leaderboardEndDate
                          ? `${format(leaderboardStartDate, 'MMM d')} – ${format(leaderboardEndDate, 'MMM d, yyyy')}`
                          : leaderboardStartDate
                          ? `From ${format(leaderboardStartDate, 'MMM d, yyyy')}`
                          : 'Current month (default)'}
                      </p>
                    </div>
                  </div>
                  <div className="pl-[52px] space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Start Date</p>
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal flex-1', !leaderboardStartDate && 'text-muted-foreground')}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {leaderboardStartDate ? format(leaderboardStartDate, 'PPP') : 'Pick start date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={leaderboardStartDate} onSelect={handleLeaderboardDateChange} disabled={(date) => date > new Date()} initialFocus className={cn('p-3 pointer-events-auto')} />
                        </PopoverContent>
                      </Popover>
                      {leaderboardStartDate && (
                        <Button variant="ghost" size="sm" onClick={() => handleLeaderboardDateChange(undefined)} className="text-muted-foreground"><X className="w-4 h-4" /></Button>
                      )}
                    </div>
                    {leaderboardStartDate && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium">End Date</p>
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal flex-1', !leaderboardEndDate && 'text-muted-foreground')}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {leaderboardEndDate ? format(leaderboardEndDate, 'PPP') : 'Pick end date'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={leaderboardEndDate} onSelect={handleLeaderboardEndDateChange} disabled={(date) => leaderboardStartDate ? date < leaderboardStartDate : false} initialFocus className={cn('p-3 pointer-events-auto')} />
                            </PopoverContent>
                          </Popover>
                          {leaderboardEndDate && (
                            <Button variant="ghost" size="sm" onClick={() => handleLeaderboardEndDateChange(undefined)} className="text-muted-foreground"><X className="w-4 h-4" /></Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : view === 'roster' ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setView('menu')}
                    className="h-8 w-8 -ml-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <DialogTitle className="font-display">Manage Roster</DialogTitle>
                    <DialogDescription>
                      Add, edit, or remove pitchers.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-2 py-4">
                {pitchers.map((pitcher) => (
                  <div
                    key={pitcher.id}
                    className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border/50"
                  >
                    {editingId === pitcher.id ? (
                      <>
                        <div className="flex-1 space-y-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Pitcher name"
                            className="h-8"
                          />
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Max/week:</Label>
                            <Input
                              type="number"
                              value={editMaxPitches}
                              onChange={(e) => setEditMaxPitches(parseInt(e.target.value) || 120)}
                              className="h-8 w-20"
                              min={1}
                              max={200}
                            />
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={handleSaveEdit} className="h-8 w-8 text-status-success">
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="h-8 w-8 text-muted-foreground">
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{pitcher.name}</p>
                          <p className="text-xs text-muted-foreground">Max: {pitcher.maxWeeklyPitches} pitches/week</p>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => handleStartEdit(pitcher)} className="h-8 w-8">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteConfirmId(pitcher.id)} className="h-8 w-8 text-status-danger hover:text-status-danger">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}

                {isAdding ? (
                  <div className="flex flex-col gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="New pitcher name"
                      className="h-8"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Max/week:</Label>
                      <Input
                        type="number"
                        value={newMaxPitches}
                        onChange={(e) => setNewMaxPitches(parseInt(e.target.value) || 120)}
                        className="h-8 w-20"
                        min={1}
                        max={200}
                      />
                      <div className="flex-1" />
                      <Button size="sm" onClick={handleAddPitcher} disabled={!newName.trim()}>
                        Add
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setIsAdding(false); setNewName(''); setNewMaxPitches(120); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => setIsAdding(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Pitcher
                  </Button>
                )}
              </div>
            </>
          ) : (
            /* Workouts View */
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setView('menu')}
                    className="h-8 w-8 -ml-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <DialogTitle className="font-display">Workouts & Leaderboard</DialogTitle>
                    <DialogDescription>
                      Manage workouts and track team accountability.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="assignments" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="assignments" className="gap-2">
                    <ClipboardCheck className="w-4 h-4" />
                    Assignments
                  </TabsTrigger>
                  <TabsTrigger value="leaderboard" className="gap-2">
                    <Trophy className="w-4 h-4" />
                     Leaderboard
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="assignments" className="flex-1 overflow-y-auto space-y-4 py-4 mt-0">
                  {pitchers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      Add pitchers to your roster first.
                    </p>
                  ) : (
                    pitchers.map((pitcher) => (
                      <div
                        key={pitcher.id}
                        className="p-4 rounded-lg bg-secondary/50 border border-border/50"
                      >
                        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{pitcher.name}</h3>
                          {pitchers.length > 1 && (workoutAssignments[pitcher.id] || []).length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-xs text-muted-foreground"
                                onClick={() => handleCascadeWorkouts(pitcher.id)}
                              >
                                <Copy className="w-3.5 h-3.5" />
                                Copy to All
                              </Button>
                              {pitchers.length > 5 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-xs text-muted-foreground"
                                  onClick={() => handleCascadeToCatchUp(pitcher.id)}
                                  title="Assign as catch-up workout to players outside the leaderboard top 5"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy to Catch-Up
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <WorkoutManagementSection
                          pitcherId={pitcher.id}
                          pitcherName={pitcher.name}
                          assignments={workoutAssignments[pitcher.id] || []}
                          onAddAssignment={handleAddAssignment}
                          onUpdateAssignment={handleUpdateAssignment}
                          onDeleteAssignment={handleDeleteAssignment}
                        />
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="leaderboard" className="flex-1 overflow-y-auto py-4 mt-0">
                  <WorkoutLeaderboard pitchers={pitchers} initialFrom={leaderboardStartDate} initialTo={leaderboardEndDate} hideDatePicker />
                </TabsContent>

                {pitchers[0]?.teamId && (
                  <div className="px-4 pb-3">
                    <a
                      href={`/team/${pitchers[0].teamId}/wall`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                    >
                      <Camera className="w-4 h-4" />
                      Open Workout Wall →
                    </a>
                  </div>
                )}
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Pitcher</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{pitcherToDelete?.name}</strong> from the roster? 
              This will not delete their outing history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-status-danger hover:bg-status-danger/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
