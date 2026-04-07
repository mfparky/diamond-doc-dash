import { useState, useEffect } from 'react';
import { CURRENT_RELEASE } from '@/lib/release-notes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

const STORAGE_KEY_PREFIX = 'whatsNew_';

export function WhatsNewDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || !CURRENT_RELEASE.enabled) return;

    const key = `${STORAGE_KEY_PREFIX}${user.id}`;
    const seen = localStorage.getItem(key);
    if (seen !== CURRENT_RELEASE.version) {
      setOpen(true);
    }
  }, [user]);

  const handleDismiss = () => {
    if (user) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${user.id}`, CURRENT_RELEASE.version);
    }
    setOpen(false);
  };

  if (!CURRENT_RELEASE.enabled || !user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{CURRENT_RELEASE.title}</DialogTitle>
          <DialogDescription>
            Version {CURRENT_RELEASE.version}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {CURRENT_RELEASE.features.map((feature, i) => (
            <div key={i} className="space-y-1">
              <h4 className="font-semibold text-foreground text-sm">{feature.heading}</h4>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
        {CURRENT_RELEASE.signoff && (
          <p className="text-sm text-muted-foreground text-right italic pt-1">{CURRENT_RELEASE.signoff}</p>
        )}
        <Button onClick={handleDismiss} className="w-full">
          Got it!
        </Button>
      </DialogContent>
    </Dialog>
  );
}
