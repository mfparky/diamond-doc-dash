import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Users, LogOut, Trash2, Sun, Moon, UserPlus, Crown } from 'lucide-react';
import { Team, TeamMember } from '@/hooks/use-teams';
import { PitcherRecord } from '@/hooks/use-pitchers';
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

interface TeamSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTeam: Team | null;
  teams: Team[];
  teamMembers: TeamMember[];
  userRole: 'owner' | 'member' | null;
  pitchers: PitcherRecord[];
  onCreateTeam: (name: string) => Promise<Team | null>;
  onJoinTeam: (code: string) => Promise<boolean>;
  onUpdateTeam: (teamId: string, updates: Partial<Team>) => Promise<boolean>;
  onRemoveMember: (memberId: string) => Promise<boolean>;
  onLeaveTeam: (teamId: string) => Promise<boolean>;
  onSwitchTeam: (team: Team) => void;
  onAddPitcher: (name: string, maxWeeklyPitches: number) => Promise<PitcherRecord | null>;
  onUpdatePitcher: (id: string, updates: { name?: string; maxWeeklyPitches?: number }) => Promise<boolean>;
  onDeletePitcher: (id: string) => Promise<boolean>;
}

export function TeamSettingsDialog({
  open,
  onOpenChange,
  currentTeam,
  teams,
  teamMembers,
  userRole,
  pitchers,
  onCreateTeam,
  onJoinTeam,
  onUpdateTeam,
  onRemoveMember,
  onLeaveTeam,
  onSwitchTeam,
  onAddPitcher,
  onUpdatePitcher,
  onDeletePitcher,
}: TeamSettingsDialogProps) {
  const [newTeamName, setNewTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null);
  const [isDark, setIsDark] = useState(() => !document.documentElement.classList.contains('light'));
  
  // Pitcher management state
  const [editingPitcherId, setEditingPitcherId] = useState<string | null>(null);
  const [editPitcherName, setEditPitcherName] = useState('');
  const [editPitcherMax, setEditPitcherMax] = useState(120);
  const [newPitcherName, setNewPitcherName] = useState('');
  const [newPitcherMax, setNewPitcherMax] = useState(120);
  const [isAddingPitcher, setIsAddingPitcher] = useState(false);
  const [deletingPitcher, setDeletingPitcher] = useState<PitcherRecord | null>(null);
  
  const { toast } = useToast();

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setIsCreating(true);
    const result = await onCreateTeam(newTeamName.trim());
    setIsCreating(false);
    if (result) {
      setNewTeamName('');
    }
  };

  const handleJoinTeam = async () => {
    if (!joinCode.trim()) return;
    setIsJoining(true);
    const result = await onJoinTeam(joinCode.trim());
    setIsJoining(false);
    if (result) {
      setJoinCode('');
    }
  };

  const copyJoinCode = () => {
    if (currentTeam?.join_code) {
      navigator.clipboard.writeText(currentTeam.join_code);
      toast({ title: 'Copied!', description: 'Join code copied to clipboard.' });
    }
  };

  const handleLeaveTeam = async () => {
    if (currentTeam) {
      await onLeaveTeam(currentTeam.id);
      setShowLeaveConfirm(false);
    }
  };

  const handleRemoveMember = async () => {
    if (removingMember) {
      await onRemoveMember(removingMember.id);
      setRemovingMember(null);
    }
  };

  // Pitcher management handlers
  const handleStartEditPitcher = (pitcher: PitcherRecord) => {
    setEditingPitcherId(pitcher.id);
    setEditPitcherName(pitcher.name);
    setEditPitcherMax(pitcher.maxWeeklyPitches);
  };

  const handleSaveEditPitcher = async () => {
    if (!editingPitcherId || !editPitcherName.trim()) return;
    await onUpdatePitcher(editingPitcherId, { name: editPitcherName, maxWeeklyPitches: editPitcherMax });
    setEditingPitcherId(null);
  };

  const handleAddPitcher = async () => {
    if (!newPitcherName.trim()) return;
    const result = await onAddPitcher(newPitcherName, newPitcherMax);
    if (result) {
      setNewPitcherName('');
      setNewPitcherMax(120);
      setIsAddingPitcher(false);
    }
  };

  const handleDeletePitcher = async () => {
    if (deletingPitcher) {
      await onDeletePitcher(deletingPitcher.id);
      setDeletingPitcher(null);
    }
  };

  const hasTeam = teams.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Team Settings</DialogTitle>
            <DialogDescription>
              {hasTeam ? 'Manage your team, roster, and preferences.' : 'Create or join a team to get started.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue={hasTeam ? "team" : "join"} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="roster">Roster</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-4">
              {/* Team Tab */}
              <TabsContent value="team" className="mt-0 space-y-4">
                {!hasTeam ? (
                  <div className="space-y-6">
                    {/* Create Team */}
                    <div className="space-y-3">
                      <h3 className="font-medium text-foreground">Create a Team</h3>
                      <div className="flex gap-2">
                        <Input
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          placeholder="Team name"
                          className="flex-1"
                        />
                        <Button onClick={handleCreateTeam} disabled={isCreating || !newTeamName.trim()}>
                          {isCreating ? 'Creating...' : 'Create'}
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Join Team */}
                    <div className="space-y-3">
                      <h3 className="font-medium text-foreground">Join a Team</h3>
                      <div className="flex gap-2">
                        <Input
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value)}
                          placeholder="Enter join code"
                          className="flex-1"
                        />
                        <Button onClick={handleJoinTeam} disabled={isJoining || !joinCode.trim()} variant="outline">
                          <UserPlus className="w-4 h-4 mr-2" />
                          {isJoining ? 'Joining...' : 'Join'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Current Team Info */}
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-foreground flex items-center gap-2">
                          {currentTeam?.name}
                          {userRole === 'owner' && <Crown className="w-4 h-4 text-yellow-500" />}
                        </h3>
                        <span className="text-xs text-muted-foreground capitalize">{userRole}</span>
                      </div>
                      
                      {/* Join Code */}
                      <div className="flex items-center gap-2 mt-3">
                        <Label className="text-xs text-muted-foreground">Join Code:</Label>
                        <code className="px-2 py-1 bg-card rounded text-sm font-mono">
                          {currentTeam?.join_code}
                        </code>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyJoinCode}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Team Members */}
                    <div className="space-y-2">
                      <h3 className="font-medium text-foreground flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Members ({teamMembers.length})
                      </h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {teamMembers.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{member.email || `User ${member.user_id.slice(0, 8)}`}</span>
                              {member.role === 'owner' && <Crown className="w-3.5 h-3.5 text-yellow-500" />}
                            </div>
                            {userRole === 'owner' && member.role !== 'owner' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setRemovingMember(member)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Switch/Join Another Team */}
                    {teams.length > 1 && (
                      <div className="space-y-2">
                        <h3 className="font-medium text-foreground">Switch Team</h3>
                        <div className="flex flex-wrap gap-2">
                          {teams.map((team) => (
                            <Button
                              key={team.id}
                              size="sm"
                              variant={team.id === currentTeam?.id ? 'default' : 'outline'}
                              onClick={() => onSwitchTeam(team)}
                            >
                              {team.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Join Another Team */}
                    <div className="space-y-3">
                      <h3 className="font-medium text-foreground">Join Another Team</h3>
                      <div className="flex gap-2">
                        <Input
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value)}
                          placeholder="Enter join code"
                          className="flex-1"
                        />
                        <Button onClick={handleJoinTeam} disabled={isJoining || !joinCode.trim()} variant="outline" size="sm">
                          Join
                        </Button>
                      </div>
                    </div>

                    {/* Leave Team */}
                    {userRole === 'member' && (
                      <Button variant="outline" className="w-full text-destructive" onClick={() => setShowLeaveConfirm(true)}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Leave Team
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Roster Tab */}
              <TabsContent value="roster" className="mt-0 space-y-4">
                {!hasTeam ? (
                  <p className="text-center text-muted-foreground py-8">
                    Create or join a team first to manage your roster.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pitchers.map((pitcher) => (
                      <div
                        key={pitcher.id}
                        className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border/50"
                      >
                        {editingPitcherId === pitcher.id ? (
                          <>
                            <div className="flex-1 space-y-2">
                              <Input
                                value={editPitcherName}
                                onChange={(e) => setEditPitcherName(e.target.value)}
                                placeholder="Pitcher name"
                                className="h-8"
                              />
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">Max/week:</Label>
                                <Input
                                  type="number"
                                  value={editPitcherMax}
                                  onChange={(e) => setEditPitcherMax(parseInt(e.target.value) || 120)}
                                  className="h-8 w-20"
                                  min={1}
                                  max={200}
                                />
                              </div>
                            </div>
                            <Button size="sm" onClick={handleSaveEditPitcher}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingPitcherId(null)}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1">
                              <p className="font-medium text-foreground">{pitcher.name}</p>
                              <p className="text-xs text-muted-foreground">Max: {pitcher.maxWeeklyPitches} pitches/week</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => handleStartEditPitcher(pitcher)}>Edit</Button>
                            {userRole === 'owner' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeletingPitcher(pitcher)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    ))}

                    {isAddingPitcher ? (
                      <div className="flex flex-col gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <Input
                          value={newPitcherName}
                          onChange={(e) => setNewPitcherName(e.target.value)}
                          placeholder="New pitcher name"
                          className="h-8"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Max/week:</Label>
                          <Input
                            type="number"
                            value={newPitcherMax}
                            onChange={(e) => setNewPitcherMax(parseInt(e.target.value) || 120)}
                            className="h-8 w-20"
                            min={1}
                            max={200}
                          />
                          <div className="flex-1" />
                          <Button size="sm" onClick={handleAddPitcher} disabled={!newPitcherName.trim()}>Add</Button>
                          <Button size="sm" variant="outline" onClick={() => { setIsAddingPitcher(false); setNewPitcherName(''); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full border-dashed" onClick={() => setIsAddingPitcher(true)}>
                        + Add Pitcher
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="mt-0 space-y-4">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Appearance</p>
                    <p className="text-xs text-muted-foreground">Toggle light/dark mode</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-2">
                    {isDark ? <><Sun className="w-4 h-4" /><span>Light</span></> : <><Moon className="w-4 h-4" /><span>Dark</span></>}
                  </Button>
                </div>

                {/* Team Settings (Owner only) */}
                {hasTeam && userRole === 'owner' && currentTeam && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-medium text-foreground">Team Name</h3>
                      <div className="flex gap-2">
                        <Input
                          value={editingTeamName || currentTeam.name}
                          onChange={(e) => setEditingTeamName(e.target.value)}
                          placeholder="Team name"
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          disabled={!editingTeamName || editingTeamName === currentTeam.name}
                          onClick={async () => {
                            await onUpdateTeam(currentTeam.id, { name: editingTeamName });
                            setEditingTeamName('');
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Leave Team Confirmation */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Team?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave {currentTeam?.name}? You'll lose access to the team's data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveTeam} className="bg-destructive hover:bg-destructive/90">
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removingMember} onOpenChange={(open) => !open && setRemovingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the team?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Pitcher Confirmation */}
      <AlertDialog open={!!deletingPitcher} onOpenChange={(open) => !open && setDeletingPitcher(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Pitcher?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deletingPitcher?.name} from the roster?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePitcher} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
