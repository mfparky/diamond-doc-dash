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

interface WhatsNewDialogProps {
  /** When true, show to anonymous viewers (e.g. parents) using a scoped storage key. */
  publicMode?: boolean;
  /** Optional scope appended to the anon storage key (e.g. playerId). */
  scopeKey?: string;
}

export function WhatsNewDialog({ publicMode = false, scopeKey }: WhatsNewDialogProps = {}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const storageKey = user
    ? `${STORAGE_KEY_PREFIX}${user.id}`
    : publicMode
      ? `${STORAGE_KEY_PREFIX}public${scopeKey ? `_${scopeKey}` : ''}`
      : null;

  useEffect(() => {
    if (!CURRENT_RELEASE.enabled) return;
    if (!storageKey) return;

    const seen = localStorage.getItem(storageKey);
    if (seen !== CURRENT_RELEASE.version) {
      setOpen(true);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    if (storageKey) {
      localStorage.setItem(storageKey, CURRENT_RELEASE.version);
    }
    setOpen(false);
  };

  if (!CURRENT_RELEASE.enabled) return null;
  if (!storageKey) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto">
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
