import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share2, X, Check, Video } from 'lucide-react';

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
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!videoBlob) return;
    setIsSaving(true);
    
    try {
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSaved(true);
      setTimeout(() => {
        onOpenChange(false);
        setSaved(false);
      }, 1500);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!videoBlob) return;
    
    try {
      const file = new File([videoBlob], fileName, { type: videoBlob.type });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
        });
        onOpenChange(false);
      } else {
        // Fallback to download if share isn't supported
        handleSave();
      }
    } catch (error) {
      // User cancelled share - that's fine
      if ((error as Error).name !== 'AbortError') {
        console.error('Share error:', error);
      }
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

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleDiscard}
            className="text-muted-foreground"
          >
            <X className="w-4 h-4 mr-2" />
            Discard
          </Button>
          
          <div className="flex gap-2 flex-1">
            <Button
              variant="outline"
              onClick={handleShare}
              className="flex-1"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={isSaving || saved}
              className="flex-1"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Saved!
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
