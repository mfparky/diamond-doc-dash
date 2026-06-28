import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Member {
  id: string;
  user_id: string;
  email?: string | null;
}

export function ManageScorekeepersDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data: tm } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();
      if (!tm) return;
      setTeamId(tm.team_id);
      await loadMembers(tm.team_id);
    })();
  }, [open, user]);

  async function loadMembers(tid: string) {
    const { data } = await supabase
      .from('team_members')
      .select('id, user_id')
      .eq('team_id', tid)
      .eq('role', 'scorekeeper');
    const rows = (data || []) as Member[];
    // Look up emails from user_approvals
    if (rows.length) {
      const ids = rows.map(r => r.user_id);
      const { data: ap } = await supabase.from('user_approvals').select('user_id, email').in('user_id', ids);
      const emailMap = new Map((ap || []).map((a: any) => [a.user_id, a.email]));
      rows.forEach(r => { r.email = emailMap.get(r.user_id) ?? null; });
    }
    setMembers(rows);
  }

  async function addScorekeeper() {
    if (!teamId || !email.trim()) return;
    setBusy(true);
    try {
      const { data: ap } = await supabase
        .from('user_approvals')
        .select('user_id, status')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      if (!ap) {
        toast({ title: 'User not found', description: 'They need to sign up first.', variant: 'destructive' });
        return;
      }
      if (ap.status !== 'approved') {
        toast({ title: 'User not approved yet', description: 'Approve their signup first.', variant: 'destructive' });
        return;
      }
      const { error } = await supabase.from('team_members').insert({
        team_id: teamId,
        user_id: ap.user_id,
        role: 'scorekeeper',
      });
      if (error) throw error;
      toast({ title: 'Scorekeeper added' });
      setEmail('');
      await loadMembers(teamId);
    } catch (e: any) {
      toast({ title: 'Could not add', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not remove', description: error.message, variant: 'destructive' });
      return;
    }
    if (teamId) await loadMembers(teamId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage scorekeepers</DialogTitle>
          <DialogDescription>
            Scorekeepers can only access the live pitch counter. Their pitches still feed Outings + Games.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sk-email">Add by email</Label>
            <div className="flex gap-2">
              <Input
                id="sk-email"
                type="email"
                placeholder="scorekeeper@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button onClick={addScorekeeper} disabled={busy || !email.trim()}>Add</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The user must sign up and be approved first.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Current scorekeepers ({members.length})</Label>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="space-y-1">
                {members.map(m => (
                  <li key={m.id} className="flex items-center justify-between rounded border border-border bg-card px-3 py-2">
                    <span className="text-sm">{m.email ?? m.user_id}</span>
                    <Button variant="ghost" size="icon" onClick={() => remove(m.id)} aria-label="Remove">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
