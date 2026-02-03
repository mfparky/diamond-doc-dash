import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Plus, Check, X, Sun, Moon, ChevronRight, ArrowLeft, Users, Palette, ClipboardCheck } from 'lucide-react';
import { PitcherRecord } from '@/hooks/use-pitchers';
import { WorkoutManagementSection } from '@/components/WorkoutManagementSection';
import { useWorkouts, WorkoutAssignment } from '@/hooks/use-workouts';
import { supabase } from '@/integrations/supabase/client';
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
  const [isDark, setIsDark] = useState(() => !document.documentElement.classList.contains('light'));
  const [workoutAssignments, setWorkoutAssignments] = useState<Record<string, WorkoutAssignment[]>>({});

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
          createdAt: row.created_at,
        });
      });
      setWorkoutAssignments(grouped);
    } catch (error) {
      console.error('Error fetching workout assignments:', error);
    }
  }, [pitchers]);

  useEffect(() => {
    if (open) {
      fetchAllWorkoutAssignments();
    }
  }, [open, fetchAllWorkoutAssignments]);

  // Add assignment handler
  const handleAddAssignment = async (pitcherId: string, title: string, description?: string): Promise<WorkoutAssignment | null> => {
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

      setWorkoutAssignments((prev) => ({
        ...prev,
        [pitcherId]: [newAssignment, ...(prev[pitcherId] || [])],
      }));

      return newAssignment;
    } catch (error) {
      console.error('Error adding assignment:', error);
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
  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
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
                    <DialogTitle className="font-display">Assign Workouts</DialogTitle>
                    <DialogDescription>
                      Set weekly accountability workouts for each pitcher.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-4 py-4">
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
                      <h3 className="font-semibold text-foreground mb-3">{pitcher.name}</h3>
                      <WorkoutManagementSection
                        pitcherId={pitcher.id}
                        pitcherName={pitcher.name}
                        assignments={workoutAssignments[pitcher.id] || []}
                        onAddAssignment={handleAddAssignment}
                        onDeleteAssignment={handleDeleteAssignment}
                      />
                    </div>
                  ))
                )}
              </div>
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
