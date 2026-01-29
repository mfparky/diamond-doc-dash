import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share2, X, Video } from 'lucide-react';

interface VideoSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoBlob: Blob | null;
  fileName: string;
  onDiscard: () => void;
}

export function VideoSaveDialog({
  open,
  onOpenChange,
  videoBlob,
  fileName,
  onDiscard,
}: VideoSaveDialogProps) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!videoBlob) return;
    setIsSharing(true);
    
    try {
      const file = new File([videoBlob], fileName, { type: videoBlob.type });
      
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: fileName,
        });
        onOpenChange(false);
        onDiscard();
      }
    } catch (error) {
      // User cancelled share - that's fine
      if ((error as Error).name !== 'AbortError') {
        console.error('Share error:', error);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleDiscard = () => {
    onDiscard();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Video Recorded
          </DialogTitle>
          <DialogDescription>
            {fileName}
          </DialogDescription>
        </DialogHeader>

        {/* Video Preview */}
        {videoBlob && (
          <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden">
            <video
              src={URL.createObjectURL(videoBlob)}
              className="w-full h-full object-cover"
              controls
              playsInline
            />
          </div>
        )}

        <DialogFooter className="flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleDiscard}
            className="text-muted-foreground"
          >
            <X className="w-4 h-4 mr-2" />
            Discard
          </Button>
          
          <Button
            onClick={handleShare}
            disabled={isSharing}
            className="flex-1"
          >
            <Share2 className="w-4 h-4 mr-2" />
            {isSharing ? 'Sharing...' : 'Share / Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
