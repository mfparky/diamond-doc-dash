import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Flame } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorkoutGallery } from '@/components/WorkoutGallery';

interface WorkoutGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pitcherId?: string;
  pitcherIds?: string[];
  teamId?: string;
  title?: string;
}

export function WorkoutGalleryDialog({ open, onOpenChange, pitcherId, pitcherIds, teamId, title }: WorkoutGalleryDialogProps) {
  const [photoCount, setPhotoCount] = useState(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Sticky header */}
        <div className="px-6 pt-5 pb-3 border-b bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Flame className="w-4 h-4 text-primary" />
              </div>
              {title || 'Workout Wall'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Celebrating {photoCount} check-in{photoCount !== 1 ? 's' : ''} from the team.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable feed */}
        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="p-4">
            {open && (
              <WorkoutGallery
                pitcherId={pitcherId}
                pitcherIds={pitcherIds}
                teamId={teamId}
                onPhotoCount={setPhotoCount}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
