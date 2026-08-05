import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTeamReady: (teamId: string) => void;
}

export function CreateOrJoinTeamDialog({ open, onOpenChange, onTeamReady }: Props) {
  const { toast } = useToast();
  const [teamName, setTeamName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!teamName.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('create_team', { p_team_name: teamName.trim() });
      if (error) throw error;
      toast({ title: 'Team created', description: `${teamName.trim()} is ready to go.` });
      onTeamReady(data as string);
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not create the team.';
      toast({ title: 'Could not create team', description: message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('join_team_by_code', { p_code: joinCode.trim() });
      if (error) throw error;
      toast({ title: "You're in!", description: 'Joined the team.' });
      onTeamReady(data as string);
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid join code.';
      toast({ title: 'Could not join team', description: message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create or join a team</DialogTitle>
          <DialogDescription>
            Start a new team, or join one your head coach already set up using their join code.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="join">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="join">Join a team</TabsTrigger>
            <TabsTrigger value="create">Create a team</TabsTrigger>
          </TabsList>

          <TabsContent value="join" className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label htmlFor="join-code">Join code</Label>
              <Input
                id="join-code"
                placeholder="e.g. a1b2c3"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <Button onClick={handleJoin} disabled={busy || !joinCode.trim()} className="w-full">
              Join team
            </Button>
          </TabsContent>

          <TabsContent value="create" className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                placeholder="e.g. Hawks 12U AA"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={busy || !teamName.trim()} className="w-full">
              Create team
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
