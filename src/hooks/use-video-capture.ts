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
  blob?: Blob;
}

interface PendingVideo {
  blob: Blob;
  fileName: string;
  metadata: VideoMetadata;
}

export function useVideoCapture() {
  const [isRecording, setIsRecording] = useState(false);
  const [capturedVideos, setCapturedVideos] = useState<CapturedVideo[]>([]);
  const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null);
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const currentFormatRef = useRef<{ mimeType: string; extension: string }>({ mimeType: 'video/mp4', extension: 'mp4' });

  // Generate filename from metadata
  const generateFileName = (metadata: VideoMetadata, extension: string): string => {
    const sanitizedName = metadata.pitcherName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const formattedDate = metadata.date.replace(/-/g, '');
    return `${sanitizedName}_${formattedDate}_pitch${metadata.pitchNumber}.${extension}`;
  };

  // Get supported video mime type - prefer MP4 for iOS compatibility
  const getSupportedMimeType = (): { mimeType: string; extension: string } => {
    const types = [
      { mimeType: 'video/mp4', extension: 'mp4' },
      { mimeType: 'video/mp4;codecs=avc1', extension: 'mp4' },
      { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
      { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
      { mimeType: 'video/webm', extension: 'webm' },
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type.mimeType)) {
        console.log('Using video format:', type.mimeType);
        return type;
      }
    }

    // Fallback
    return { mimeType: 'video/webm', extension: 'webm' };
  };

  // Check if running on native platform or in Capacitor WebView
  // Note: When using live reload with server.url, isNativePlatform() returns false
  // We check for Capacitor plugins being available as a fallback
  const isNative = Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'web';

  // Start video recording
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      if (isNative) {
        // On native, we'll use the Camera plugin for video capture
        // Note: Camera.getPhoto with video is limited, so we use web API for recording
        // but save to native filesystem
      }

      // Use MediaRecorder API for recording (works on web and in WebView)
      // Request high frame rate for slow motion playback, no audio
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { exact: 'environment' }, // Force back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 240, min: 120 }, // High FPS for slow motion
        },
        audio: false, // No audio for cleaner slow-mo files
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Get supported format - prefer MP4 for iOS
      const format = getSupportedMimeType();
      currentFormatRef.current = format;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: format.mimeType,
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

        const format = currentFormatRef.current;
        const blob = new Blob(chunksRef.current, { type: format.mimeType });
        const fileName = generateFileName(metadata, format.extension);

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
            // Web - store pending video for user to review
            setPendingVideo({
              blob,
              fileName,
              metadata,
            });
            
            const capturedVideo: CapturedVideo = {
              filePath: URL.createObjectURL(blob),
              fileName,
              metadata,
              blob,
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

  // Clear pending video
  const clearPendingVideo = useCallback(() => {
    if (pendingVideo?.blob) {
      URL.revokeObjectURL(URL.createObjectURL(pendingVideo.blob));
    }
    setPendingVideo(null);
  }, [pendingVideo]);

  // Download video helper for external use
  const saveVideo = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Video Saved',
      description: `${fileName} saved to your device.`,
    });
    
    clearPendingVideo();
  }, [toast, clearPendingVideo]);

  return {
    isRecording,
    capturedVideos,
    pendingVideo,
    startRecording,
    stopRecording,
    cancelRecording,
    clearPendingVideo,
    saveVideo,
    isNative,
  };
}
