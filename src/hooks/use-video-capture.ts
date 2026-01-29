import { useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Media } from '@capacitor-community/media';
import { useToast } from '@/hooks/use-toast';

interface VideoMetadata {
  pitcherName: string;
  date: string;
  pitchNumber: number;
  pitchType: string;
  velocity?: number;
  isStrike: boolean;
}

interface CapturedVideo {
  filePath: string;
  fileName: string;
  metadata: VideoMetadata;
}

export function useVideoCapture() {
  const [isRecording, setIsRecording] = useState(false);
  const [capturedVideos, setCapturedVideos] = useState<CapturedVideo[]>([]);
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Generate filename from metadata
  const generateFileName = (metadata: VideoMetadata): string => {
    const sanitizedName = metadata.pitcherName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const formattedDate = metadata.date.replace(/-/g, '');
    return `${sanitizedName}_${formattedDate}_pitch${metadata.pitchNumber}.mp4`;
  };

  // Check if running on native platform
  const isNative = Capacitor.isNativePlatform();

  // Start video recording
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      if (isNative) {
        // On native, we'll use the Camera plugin for video capture
        // Note: Camera.getPhoto with video is limited, so we use web API for recording
        // but save to native filesystem
      }

      // Use MediaRecorder API for recording (works on web and in WebView)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Back camera
        audio: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Camera Error',
        description: 'Could not access camera. Please grant camera permissions.',
        variant: 'destructive',
      });
      return false;
    }
  }, [isNative, toast]);

  // Stop recording and save video
  const stopRecording = useCallback(async (metadata: VideoMetadata): Promise<CapturedVideo | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !streamRef.current) {
        resolve(null);
        return;
      }

      const mediaRecorder = mediaRecorderRef.current;

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);

        if (chunksRef.current.length === 0) {
          resolve(null);
          return;
        }

        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const fileName = generateFileName(metadata);

        try {
          if (isNative) {
            // Save to camera roll using Capacitor Media plugin
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Data = (reader.result as string).split(',')[1];
              
              try {
                // First save temporarily to filesystem
                const tempPath = `temp_${fileName}`;
                const tempResult = await Filesystem.writeFile({
                  path: tempPath,
                  data: base64Data,
                  directory: Directory.Cache,
                });

                // Save to camera roll using Media plugin
                await Media.saveVideo({
                  path: tempResult.uri,
                });

                // Clean up temp file
                await Filesystem.deleteFile({
                  path: tempPath,
                  directory: Directory.Cache,
                });

                const capturedVideo: CapturedVideo = {
                  filePath: tempResult.uri,
                  fileName,
                  metadata,
                };

                setCapturedVideos(prev => [...prev, capturedVideo]);
                
                toast({
                  title: 'Video Saved!',
                  description: `${fileName} saved to Camera Roll`,
                });

                resolve(capturedVideo);
              } catch (mediaError) {
                console.error('Media save error:', mediaError);
                // Fallback to download
                downloadVideo(blob, fileName);
                resolve(null);
              }
            };
            reader.readAsDataURL(blob);
          } else {
            // Web fallback - trigger download
            downloadVideo(blob, fileName);
            
            const capturedVideo: CapturedVideo = {
              filePath: URL.createObjectURL(blob),
              fileName,
              metadata,
            };

            setCapturedVideos(prev => [...prev, capturedVideo]);
            resolve(capturedVideo);
          }
        } catch (error) {
          console.error('Error saving video:', error);
          toast({
            title: 'Save Error',
            description: 'Could not save video. Please try again.',
            variant: 'destructive',
          });
          resolve(null);
        }
      };

      mediaRecorder.stop();
    });
  }, [isNative, toast]);

  // Download video (web fallback)
  const downloadVideo = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Video Downloaded',
      description: `${fileName} downloaded to your device.`,
    });
  };

  // Cancel recording
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    capturedVideos,
    startRecording,
    stopRecording,
    cancelRecording,
    isNative,
  };
}
