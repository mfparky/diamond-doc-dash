import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Video, StopCircle, Upload, X, Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';
import { compressVideo, formatFileSize, CompressionProgress } from '@/lib/video-compression';

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

export function VideoCapture({
  slot,
  outingId,
  userId,
  pitchTypes = DEFAULT_PITCH_TYPES,
  existingUrl,
  existingPitchType,
  existingVelocity,
  onVideoSaved,
  onVideoRemoved,
}: VideoCaptureProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const [pitchType, setPitchType] = useState<string>(existingPitchType?.toString() || '');
  const [velocity, setVelocity] = useState<string>(existingVelocity?.toString() || '');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = useCallback(async () => {
    try {
      // Request camera with high frame rate for slow-mo capability
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 120, min: 60 }, // High frame rate for slow-mo
        },
        audio: false,
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9' 
          : 'video/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Camera access denied',
        description: 'Please allow camera access to record video.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (50MB limit before compression)
    if (file.size > 52428800) {
      toast({
        title: 'File too large',
        description: 'Video must be under 50MB.',
        variant: 'destructive',
      });
      return;
    }

    setOriginalSize(file.size);
    setIsCompressing(true);
    setCompressionProgress({ stage: 'loading', progress: 0 });

    try {
      const compressedBlob = await compressVideo(file, {
        maxWidth: 1280,
        maxHeight: 720,
        videoBitrate: 2_000_000,
        onProgress: setCompressionProgress,
      });

      setCompressedSize(compressedBlob.size);
      setRecordedBlob(compressedBlob);
      const url = URL.createObjectURL(compressedBlob);
      setPreviewUrl(url);

      const savings = ((file.size - compressedBlob.size) / file.size * 100).toFixed(0);
      if (compressedBlob.size < file.size) {
        toast({
          title: 'Video compressed',
          description: `Reduced from ${formatFileSize(file.size)} to ${formatFileSize(compressedBlob.size)} (${savings}% smaller)`,
        });
      }
    } catch (error) {
      console.error('Compression error:', error);
      // Fall back to original file
      setRecordedBlob(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setCompressedSize(file.size);
    } finally {
      setIsCompressing(false);
      setCompressionProgress(null);
    }
  }, [toast]);

  const uploadVideo = useCallback(async () => {
    if (!recordedBlob) return;

    setIsUploading(true);
    try {
      const fileExt = recordedBlob.type.includes('mp4') ? 'mp4' : 
                      recordedBlob.type.includes('quicktime') ? 'mov' : 'webm';
      const fileName = `${userId}/${outingId}/video_${slot}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('outing-videos')
        .upload(fileName, recordedBlob, {
          contentType: recordedBlob.type,
          upsert: true,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('outing-videos')
        .getPublicUrl(data.path);

      onVideoSaved(
        publicUrl,
        pitchType ? parseInt(pitchType) : null,
        velocity ? parseInt(velocity) : null
      );

      toast({
        title: 'Video saved',
        description: `Video ${slot} has been uploaded successfully.`,
      });
    } catch (error) {
      console.error('Error uploading video:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload video. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [recordedBlob, userId, outingId, slot, pitchType, velocity, onVideoSaved, toast]);

  const removeVideo = useCallback(() => {
    setRecordedBlob(null);
    setPreviewUrl(null);
    setPitchType('');
    setVelocity('');
    setOriginalSize(null);
    setCompressedSize(null);
    onVideoRemoved();
  }, [onVideoRemoved]);

  const activePitchTypes = Object.entries(pitchTypes).filter(([_, label]) => label.trim() !== '');

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            Video {slot}
          </h4>
          {previewUrl && (
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

        {/* Video Preview / Recording */}
        <div className="relative aspect-video bg-secondary/50 rounded-lg overflow-hidden">
          {isCompressing ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-foreground font-medium">
                {compressionProgress?.stage === 'loading' && 'Loading video...'}
                {compressionProgress?.stage === 'compressing' && 'Compressing video...'}
                {compressionProgress?.stage === 'finalizing' && 'Finalizing...'}
              </p>
              <Progress value={compressionProgress?.progress || 0} className="w-full max-w-[200px]" />
              <p className="text-xs text-muted-foreground">
                {compressionProgress?.progress || 0}%
              </p>
            </div>
          ) : previewUrl ? (
            <video
              ref={videoRef}
              src={isRecording ? undefined : previewUrl}
              controls={!isRecording}
              className="w-full h-full object-contain"
              playsInline
            />
          ) : isRecording ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Camera className="w-8 h-8" />
              <p className="text-sm">No video recorded</p>
            </div>
          )}

          {isRecording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-destructive/90 text-destructive-foreground px-3 py-1 rounded-full text-sm">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Recording
            </div>
          )}
        </div>

        {/* Compression info */}
        {originalSize && compressedSize && compressedSize < originalSize && (
          <div className="text-xs text-muted-foreground bg-success/10 text-success px-3 py-2 rounded-md">
            Compressed: {formatFileSize(originalSize)} → {formatFileSize(compressedSize)} 
            ({((originalSize - compressedSize) / originalSize * 100).toFixed(0)}% saved)
          </div>
        )}

        {/* Recording Controls */}
        {!previewUrl && !isCompressing && (
          <div className="flex gap-2">
            {isRecording ? (
              <Button
                onClick={stopRecording}
                variant="destructive"
                className="flex-1"
              >
                <StopCircle className="w-4 h-4 mr-2" />
                Stop Recording
              </Button>
            ) : (
              <>
                <Button
                  onClick={startRecording}
                  variant="default"
                  className="flex-1"
                >
                  <Video className="w-4 h-4 mr-2" />
                  Record
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </>
            )}
          </div>
        )}

        {/* Pitch Info */}
        {previewUrl && (
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
        {recordedBlob && !existingUrl && (
          <Button
            onClick={uploadVideo}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? 'Uploading...' : 'Save Video'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
