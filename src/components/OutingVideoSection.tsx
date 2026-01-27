import { useState, useEffect } from 'react';
import { VideoCapture } from './VideoCapture';
import { VideoPlayer } from './VideoPlayer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video } from 'lucide-react';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OutingVideoSectionProps {
  outingId: string;
  pitcherId: string;
  pitchTypes?: PitchTypeConfig;
  videoUrl1?: string | null;
  videoUrl2?: string | null;
  video1PitchType?: number | null;
  video1Velocity?: number | null;
  video2PitchType?: number | null;
  video2Velocity?: number | null;
  readOnly?: boolean;
  onVideosUpdated?: () => void;
}

export function OutingVideoSection({
  outingId,
  pitcherId,
  pitchTypes = DEFAULT_PITCH_TYPES,
  videoUrl1,
  videoUrl2,
  video1PitchType,
  video1Velocity,
  video2PitchType,
  video2Velocity,
  readOnly = false,
  onVideosUpdated,
}: OutingVideoSectionProps) {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [localVideo1, setLocalVideo1] = useState(videoUrl1);
  const [localVideo2, setLocalVideo2] = useState(videoUrl2);
  const [localPitchType1, setLocalPitchType1] = useState(video1PitchType);
  const [localVelocity1, setLocalVelocity1] = useState(video1Velocity);
  const [localPitchType2, setLocalPitchType2] = useState(video2PitchType);
  const [localVelocity2, setLocalVelocity2] = useState(video2Velocity);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const handleVideoSaved = async (
    slot: 1 | 2,
    url: string,
    pitchType: number | null,
    velocity: number | null
  ) => {
    try {
      const updateData: Record<string, unknown> = slot === 1
        ? { video_url_1: url, video_1_pitch_type: pitchType, video_1_velocity: velocity }
        : { video_url_2: url, video_2_pitch_type: pitchType, video_2_velocity: velocity };

      const { error } = await supabase
        .from('outings')
        .update(updateData)
        .eq('id', outingId);

      if (error) throw error;

      if (slot === 1) {
        setLocalVideo1(url);
        setLocalPitchType1(pitchType);
        setLocalVelocity1(velocity);
      } else {
        setLocalVideo2(url);
        setLocalPitchType2(pitchType);
        setLocalVelocity2(velocity);
      }

      onVideosUpdated?.();
    } catch (error) {
      console.error('Error saving video metadata:', error);
      toast({
        title: 'Error saving video',
        description: 'Could not save video metadata.',
        variant: 'destructive',
      });
    }
  };

  const handleVideoRemoved = async (slot: 1 | 2) => {
    try {
      const updateData: Record<string, unknown> = slot === 1
        ? { video_url_1: null, video_1_pitch_type: null, video_1_velocity: null }
        : { video_url_2: null, video_2_pitch_type: null, video_2_velocity: null };

      const { error } = await supabase
        .from('outings')
        .update(updateData)
        .eq('id', outingId);

      if (error) throw error;

      if (slot === 1) {
        setLocalVideo1(null);
        setLocalPitchType1(null);
        setLocalVelocity1(null);
      } else {
        setLocalVideo2(null);
        setLocalPitchType2(null);
        setLocalVelocity2(null);
      }

      onVideosUpdated?.();
    } catch (error) {
      console.error('Error removing video:', error);
    }
  };

  const hasAnyVideo = localVideo1 || localVideo2;

  // Read-only mode: just show videos
  if (readOnly) {
    if (!hasAnyVideo) return null;

    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Session Videos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {localVideo1 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Video 1</p>
              <VideoPlayer
                url={localVideo1}
                pitchType={localPitchType1 || undefined}
                velocity={localVelocity1 || undefined}
                pitchTypes={pitchTypes}
              />
            </div>
          )}
          {localVideo2 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Video 2</p>
              <VideoPlayer
                url={localVideo2}
                pitchType={localPitchType2 || undefined}
                velocity={localVelocity2 || undefined}
                pitchTypes={pitchTypes}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Edit mode
  if (!userId) {
    return (
      <Card className="glass-card">
        <CardContent className="p-4 text-center text-muted-foreground">
          Sign in to record videos.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          Session Videos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="video1" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="video1" className="text-xs">
              Video 1 {localVideo1 && '✓'}
            </TabsTrigger>
            <TabsTrigger value="video2" className="text-xs">
              Video 2 {localVideo2 && '✓'}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="video1">
            {localVideo1 ? (
              <div className="space-y-3">
                <VideoPlayer
                  url={localVideo1}
                  pitchType={localPitchType1 || undefined}
                  velocity={localVelocity1 || undefined}
                  pitchTypes={pitchTypes}
                />
                <button
                  onClick={() => handleVideoRemoved(1)}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove video
                </button>
              </div>
            ) : (
              <VideoCapture
                slot={1}
                outingId={outingId}
                userId={userId}
                pitchTypes={pitchTypes}
                onVideoSaved={(url, pt, vel) => handleVideoSaved(1, url, pt, vel)}
                onVideoRemoved={() => handleVideoRemoved(1)}
              />
            )}
          </TabsContent>
          
          <TabsContent value="video2">
            {localVideo2 ? (
              <div className="space-y-3">
                <VideoPlayer
                  url={localVideo2}
                  pitchType={localPitchType2 || undefined}
                  velocity={localVelocity2 || undefined}
                  pitchTypes={pitchTypes}
                />
                <button
                  onClick={() => handleVideoRemoved(2)}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove video
                </button>
              </div>
            ) : (
              <VideoCapture
                slot={2}
                outingId={outingId}
                userId={userId}
                pitchTypes={pitchTypes}
                onVideoSaved={(url, pt, vel) => handleVideoSaved(2, url, pt, vel)}
                onVideoRemoved={() => handleVideoRemoved(2)}
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
