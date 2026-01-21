import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { PitcherRecord } from '@/hooks/use-pitchers';
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

export function RosterManagementDialog({
  open,
  onOpenChange,
  pitchers,
  onAddPitcher,
  onUpdatePitcher,
  onDeletePitcher,
}: RosterManagementDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMaxPitches, setEditMaxPitches] = useState(120);
  const [newName, setNewName] = useState('');
  const [newMaxPitches, setNewMaxPitches] = useState(120);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Manage Roster</DialogTitle>
            <DialogDescription>
              Add, edit, or remove pitchers from your roster.
            </DialogDescription>
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
