import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Play, Pause, RotateCcw, Gauge, SkipBack, SkipForward,
  Camera, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { useToast } from '@/hooks/use-toast';

interface EnhancedVideoPlayerProps {
  url: string;
  pitchType?: number;
  velocity?: number;
  pitchTypes?: PitchTypeConfig;
  showControls?: boolean;
  compact?: boolean;
  onScreenshot?: (dataUrl: string, timestamp: number) => void;
}

const PLAYBACK_SPEEDS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2];
const FRAME_STEP = 1 / 30; // ~30fps

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function EnhancedVideoPlayer({
  url,
  pitchType,
  velocity,
  pitchTypes = DEFAULT_PITCH_TYPES,
  showControls = true,
  compact = false,
  onScreenshot,
}: EnhancedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [screenshotFlash, setScreenshotFlash] = useState(false);
  const { toast } = useToast();

  const youtubeId = extractYouTubeId(url);
  const isYouTube = !!youtubeId;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isYouTube) return;

    const handleTimeUpdate = () => setProgress(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [isYouTube]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const restart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
  };

  const setSpeed = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleSeek = (value: number[]) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = value[0];
    setProgress(value[0]);
  };

  // Frame-by-frame stepping
  const stepFrame = useCallback((direction: 'forward' | 'back') => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    const newTime = direction === 'forward'
      ? Math.min(video.currentTime + FRAME_STEP, video.duration)
      : Math.max(video.currentTime - FRAME_STEP, 0);
    video.currentTime = newTime;
    setProgress(newTime);
  }, []);

  // Skip 5 seconds
  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration));
    video.currentTime = newTime;
    setProgress(newTime);
  }, []);

  // Screenshot capture
  const captureScreenshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // Add pitch info overlay
    if (pitchType || velocity) {
      const pitchLabel = pitchType ? (pitchTypes[pitchType.toString()] || `P${pitchType}`) : null;
      const pitchColor = pitchType ? PITCH_TYPE_COLORS[pitchType.toString()] : null;

      ctx.font = `bold ${Math.round(canvas.height * 0.04)}px system-ui`;
      let xOffset = 20;
      const yPos = Math.round(canvas.height * 0.06);

      if (pitchLabel) {
        const metrics = ctx.measureText(pitchLabel);
        const padding = 8;
        ctx.fillStyle = pitchColor || '#3b82f6';
        ctx.roundRect(xOffset - padding, yPos - canvas.height * 0.035, metrics.width + padding * 2, canvas.height * 0.05, 6);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(pitchLabel, xOffset, yPos);
        xOffset += metrics.width + padding * 2 + 10;
      }

      if (velocity) {
        const veloText = `${velocity} mph`;
        const metrics = ctx.measureText(veloText);
        const padding = 8;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.roundRect(xOffset - padding, yPos - canvas.height * 0.035, metrics.width + padding * 2, canvas.height * 0.05, 6);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(veloText, xOffset, yPos);
      }
    }

    // Add timestamp watermark
    const timeText = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    ctx.font = `${Math.round(canvas.height * 0.025)}px system-ui`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(timeText, 20, canvas.height - 20);

    const dataUrl = canvas.toDataURL('image/png');

    // Flash effect
    setScreenshotFlash(true);
    setTimeout(() => setScreenshotFlash(false), 200);

    if (onScreenshot) {
      onScreenshot(dataUrl, video.currentTime);
    } else {
      // Download
      const link = document.createElement('a');
      link.download = `pitch-screenshot-${formatTime(video.currentTime).replace(':', '-')}.png`;
      link.href = dataUrl;
      link.click();
    }

    toast({
      title: 'Screenshot captured',
      description: `Frame at ${formatTime(video.currentTime)}`,
    });
  }, [pitchType, velocity, pitchTypes, onScreenshot, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isYouTube) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) skip(5);
          else stepFrame('forward');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) skip(-5);
          else stepFrame('back');
          break;
        case 's':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            captureScreenshot();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isYouTube, stepFrame, skip, captureScreenshot]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const pitchLabel = pitchType ? pitchTypes[pitchType.toString()] || `P${pitchType}` : null;
  const pitchColor = pitchType ? PITCH_TYPE_COLORS[pitchType.toString()] : null;

  // YouTube embed — same as before, no frame stepping available
  if (isYouTube && youtubeId) {
    return (
      <div className={`space-y-2 ${compact ? '' : 'bg-secondary/30 rounded-lg p-3'}`}>
        {(pitchLabel || velocity) && (
          <div className="flex items-center gap-2 mb-2">
            {pitchLabel && (
              <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: pitchColor || 'hsl(var(--primary))' }}>
                {pitchLabel}
              </span>
            )}
            {velocity && (
              <span className="px-2 py-0.5 rounded bg-secondary text-foreground text-xs font-bold flex items-center gap-1">
                <Gauge className="w-3 h-3" />{velocity} mph
              </span>
            )}
          </div>
        )}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="YouTube video"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // Enhanced native video player
  return (
    <div className={`space-y-2 ${compact ? '' : 'bg-secondary/30 rounded-lg p-3'}`}>
      {/* Hidden canvas for screenshots */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={url}
          className="w-full h-full object-contain"
          playsInline
          preload="metadata"
          onClick={togglePlay}
        />

        {/* Screenshot flash effect */}
        {screenshotFlash && (
          <div className="absolute inset-0 bg-white/80 pointer-events-none animate-fade-out" />
        )}

        {/* Pitch Info Overlay */}
        {(pitchLabel || velocity) && (
          <div className="absolute top-2 left-2 flex items-center gap-2">
            {pitchLabel && (
              <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: pitchColor || 'hsl(var(--primary))' }}>
                {pitchLabel}
              </span>
            )}
            {velocity && (
              <span className="px-2 py-0.5 rounded bg-black/70 text-white text-xs font-bold flex items-center gap-1">
                <Gauge className="w-3 h-3" />{velocity} mph
              </span>
            )}
          </div>
        )}

        {/* Speed Indicator */}
        {playbackRate !== 1 && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-accent/90 text-accent-foreground text-xs font-bold">
            {playbackRate}x
          </div>
        )}

        {/* Click to play overlay */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-8 h-8 text-primary ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="space-y-2">
          {/* Progress Bar with precise time */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-14 font-mono">{formatTime(progress)}</span>
            <Slider
              value={[progress]}
              min={0}
              max={duration || 1}
              step={0.001}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="w-14 text-right font-mono">{formatTime(duration)}</span>
          </div>

          {/* Main Controls Row */}
          <div className="flex items-center justify-center gap-1">
            {/* Skip back 5s */}
            <Button variant="ghost" size="sm" onClick={() => skip(-5)} className="w-9 h-9 p-0" title="Skip back 5s">
              <SkipBack className="w-4 h-4" />
            </Button>

            {/* Frame back */}
            <Button variant="outline" size="sm" onClick={() => stepFrame('back')} className="w-9 h-9 p-0" title="Previous frame">
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Play/Pause */}
            <Button variant="default" size="sm" onClick={togglePlay} className="w-12 h-12 p-0 rounded-full">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>

            {/* Frame forward */}
            <Button variant="outline" size="sm" onClick={() => stepFrame('forward')} className="w-9 h-9 p-0" title="Next frame">
              <ChevronRight className="w-4 h-4" />
            </Button>

            {/* Skip forward 5s */}
            <Button variant="ghost" size="sm" onClick={() => skip(5)} className="w-9 h-9 p-0" title="Skip forward 5s">
              <SkipForward className="w-4 h-4" />
            </Button>

            {/* Divider */}
            <div className="w-px h-6 bg-border mx-1" />

            {/* Screenshot */}
            <Button variant="outline" size="sm" onClick={captureScreenshot} className="w-9 h-9 p-0" title="Capture screenshot (S)">
              <Camera className="w-4 h-4" />
            </Button>

            {/* Restart */}
            <Button variant="ghost" size="sm" onClick={restart} className="w-9 h-9 p-0" title="Restart">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {/* Speed Presets */}
          <div className="flex justify-center gap-1">
            {PLAYBACK_SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={() => setSpeed(speed)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  playbackRate === speed
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                {speed === 1 ? '1x' : `${speed}x`}
              </button>
            ))}
          </div>

          {/* Keyboard hints */}
          <div className="flex justify-center gap-4 text-[10px] text-muted-foreground/60">
            <span>Space: Play/Pause</span>
            <span>Arrow: Frame step</span>
            <span>Shift+Arrow: Skip 5s</span>
            <span>S: Screenshot</span>
          </div>
        </div>
      )}
    </div>
  );
}
