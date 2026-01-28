import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, X, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';

interface VideoCaptureProps {
  slot: 1 | 2;
  outingId: string;
  userId: string;
  pitchTypes?: PitchTypeConfig;
  existingUrl?: string;
  existingPitchType?: number;
  existingVelocity?: number;
  onVideoSaved: (url: string, pitchType: number | null, velocity: number | null) => void;
  onVideoRemoved: () => void;
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the ID itself
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function VideoCapture({
  slot,
  pitchTypes = DEFAULT_PITCH_TYPES,
  existingUrl,
  existingPitchType,
  existingVelocity,
  onVideoSaved,
  onVideoRemoved,
}: VideoCaptureProps) {
  const { toast } = useToast();
  const [youtubeUrl, setYoutubeUrl] = useState<string>(existingUrl || '');
  const [pitchType, setPitchType] = useState<string>(existingPitchType?.toString() || '');
  const [velocity, setVelocity] = useState<string>(existingVelocity?.toString() || '');

  const videoId = extractYouTubeId(youtubeUrl);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;

  const handleSave = () => {
    if (!videoId) {
      toast({
        title: 'Invalid YouTube URL',
        description: 'Please enter a valid YouTube video URL.',
        variant: 'destructive',
      });
      return;
    }

    onVideoSaved(
      youtubeUrl,
      pitchType ? parseInt(pitchType) : null,
      velocity ? parseInt(velocity) : null
    );

    toast({
      title: 'Video saved',
      description: `Video ${slot} has been saved successfully.`,
    });
  };

  const removeVideo = () => {
    setYoutubeUrl('');
    setPitchType('');
    setVelocity('');
    onVideoRemoved();
  };

  const activePitchTypes = Object.entries(pitchTypes).filter(([_, label]) => label.trim() !== '');

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            Video {slot}
          </h4>
          {youtubeUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={removeVideo}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* YouTube URL Input */}
        <div className="space-y-2">
          <Label htmlFor={`youtube-url-${slot}`} className="text-xs flex items-center gap-1">
            <LinkIcon className="w-3 h-3" />
            YouTube URL
          </Label>
          <Input
            id={`youtube-url-${slot}`}
            type="url"
            placeholder="https://youtube.com/watch?v=... or youtu.be/..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
          />
        </div>

        {/* Video Preview */}
        {embedUrl && (
          <div className="relative aspect-video bg-secondary/50 rounded-lg overflow-hidden">
            <iframe
              src={embedUrl}
              title={`YouTube video ${slot}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Pitch Info */}
        {youtubeUrl && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`pitch-type-${slot}`} className="text-xs">Pitch Type</Label>
              <Select value={pitchType} onValueChange={setPitchType}>
                <SelectTrigger id={`pitch-type-${slot}`}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {activePitchTypes.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`velocity-${slot}`} className="text-xs">Velocity (mph)</Label>
              <Input
                id={`velocity-${slot}`}
                type="number"
                min="30"
                max="110"
                placeholder="--"
                value={velocity}
                onChange={(e) => setVelocity(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Save Button */}
        {videoId && !existingUrl && (
          <Button
            onClick={handleSave}
            className="w-full"
          >
            Save Video
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
