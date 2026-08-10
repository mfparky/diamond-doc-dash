import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PendingUser {
  id: string;
  user_id: string;
  email: string;
  created_at: string;
}

export function PendingApprovalsDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-approvals', {
        body: { action: 'list_pending' },
      });
      if (error) throw error;
      setPending(data?.pending ?? []);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load pending signups.';
      toast({ title: 'Could not load pending signups', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) loadPending();
  }, [open, loadPending]);

  async function decide(userId: string, action: 'approve' | 'reject') {
    setBusyUserId(userId);
    try {
      const { error } = await supabase.functions.invoke('manage-approvals', {
        body: { action, user_id: userId },
      });
      if (error) throw error;
      toast({ title: action === 'approve' ? 'User approved' : 'User rejected' });
      await loadPending();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not update user.';
      toast({ title: 'Could not update user', description: message, variant: 'destructive' });
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pending approvals</DialogTitle>
          <DialogDescription>
            New signups wait here until approved. Approving only lets someone sign in —
            they still need a join code (or to create their own team) to see any data.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending signups.</p>
        ) : (
          <ul className="space-y-1">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-border bg-card px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm truncate">{p.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={busyUserId === p.user_id}
                    onClick={() => decide(p.user_id, 'approve')}
                    aria-label="Approve"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={busyUserId === p.user_id}
                    onClick={() => decide(p.user_id, 'reject')}
                    aria-label="Reject"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
