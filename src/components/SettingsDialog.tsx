import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useDashboardSettings } from '@/hooks/use-dashboard-settings';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Per-coach app settings. Currently one toggle (workouts). New toggles get
 * appended as sibling <li> blocks — no per-setting plumbing required.
 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, isLoading, setWorkoutsEnabled } = useDashboardSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Settings</DialogTitle>
          <DialogDescription>
            Coach-only preferences. Changes are private to your account.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-4 pt-2">
          <li className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Label htmlFor="workouts-toggle" className="font-medium">
                Workouts features
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Show the Workouts tab, accountability widgets, and the workout
                leaderboard on the Team page.
              </p>
            </div>
            <Switch
              id="workouts-toggle"
              checked={settings.workoutsEnabled}
              disabled={isLoading}
              onCheckedChange={(checked) => setWorkoutsEnabled(checked)}
            />
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}
