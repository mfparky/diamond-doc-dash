import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Camera } from 'lucide-react';
import { WorkoutGallery } from '@/components/WorkoutGallery';

interface WorkoutGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pitcherId?: string;
  teamId?: string;
  title?: string;
}

export function WorkoutGalleryDialog({ open, onOpenChange, pitcherId, teamId, title }: WorkoutGalleryDialogProps) {
  const [photoCount, setPhotoCount] = useState(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {title || 'Workout Gallery'}
          </DialogTitle>
          <DialogDescription>
            {photoCount} photo{photoCount !== 1 ? 's' : ''} from workout check-ins.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <WorkoutGallery
            pitcherId={pitcherId}
            teamId={teamId}
            onPhotoCount={setPhotoCount}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
