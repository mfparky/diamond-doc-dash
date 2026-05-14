import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw, Gauge } from 'lucide-react';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';

interface VideoPlayerProps {
  url: string;
  pitchType?: number;
  velocity?: number;
  pitchTypes?: PitchTypeConfig;
  showControls?: boolean;
  compact?: boolean;
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1];

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

// Check if URL is a YouTube link
function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

export function VideoPlayer({
  url,
  pitchType,
  velocity,
  pitchTypes = DEFAULT_PITCH_TYPES,
  showControls = true,
  compact = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const youtubeId = extractYouTubeId(url);
  const isYouTube = isYouTubeUrl(url);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isYouTube) return;

    const handleTimeUpdate = () => {
      setProgress(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isYouTube]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const restart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
  };

  const cycleSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newRate = PLAYBACK_SPEEDS[nextIndex];
    setPlaybackRate(newRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = newRate;
    }
  };

  const handleSeek = (value: number[]) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = value[0];
    setProgress(value[0]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const pitchLabel = pitchType ? pitchTypes[pitchType.toString()] || `P${pitchType}` : null;
  const pitchColor = pitchType ? PITCH_TYPE_COLORS[pitchType.toString()] : null;

  // YouTube embed
  if (isYouTube && youtubeId) {
    return (
      <div className={`space-y-2 ${compact ? '' : 'bg-secondary/30 rounded-lg p-3'}`}>
        {/* Pitch Info Header */}
        {(pitchLabel || velocity) && (
          <div className="flex items-center gap-2 mb-2">
            {pitchLabel && (
              <span
                className="px-2 py-0.5 rounded text-xs font-bold text-white"
                style={{ backgroundColor: pitchColor || 'hsl(var(--primary))' }}
              >
                {pitchLabel}
              </span>
            )}
            {velocity && (
              <span className="px-2 py-0.5 rounded bg-secondary text-foreground text-xs font-bold flex items-center gap-1">
                <Gauge className="w-3 h-3" />
                {velocity} mph
              </span>
            )}
          </div>
        )}
        
        {/* YouTube Embed */}
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

  // Native video player (for uploaded videos)
  return (
    <div className={`space-y-2 ${compact ? '' : 'bg-secondary/30 rounded-lg p-3'}`}>
      {/* Video */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={url}
          className="w-full h-full object-contain"
          playsInline
          preload="metadata"
        />

        {/* Pitch Info Overlay */}
        {(pitchLabel || velocity) && (
          <div className="absolute top-2 left-2 flex items-center gap-2">
            {pitchLabel && (
              <span
                className="px-2 py-0.5 rounded text-xs font-bold text-white"
                style={{ backgroundColor: pitchColor || 'hsl(var(--primary))' }}
              >
                {pitchLabel}
              </span>
            )}
            {velocity && (
              <span className="px-2 py-0.5 rounded bg-black/70 text-white text-xs font-bold flex items-center gap-1">
                <Gauge className="w-3 h-3" />
                {velocity} mph
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
          {/* Progress Bar */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-10">{formatTime(progress)}</span>
            <Slider
              value={[progress]}
              min={0}
              max={duration || 1}
              step={0.01}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="w-10 text-right">{formatTime(duration)}</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={restart}
              className="w-10 h-10 p-0"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={togglePlay}
              className="w-12 h-12 p-0 rounded-full"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={cycleSpeed}
              className="h-10 px-3 font-mono text-xs"
            >
              {playbackRate}x
            </Button>
          </div>

          {/* Speed Presets */}
          <div className="flex justify-center gap-1">
            {PLAYBACK_SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={() => {
                  setPlaybackRate(speed);
                  if (videoRef.current) {
                    videoRef.current.playbackRate = speed;
                  }
                }}
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
        </div>
      )}
    </div>
  );
}

// Compact video card for lists
export function VideoCard({
  url,
  pitchType,
  velocity,
  pitchTypes = DEFAULT_PITCH_TYPES,
  label,
  onClick,
}: VideoPlayerProps & { label?: string; onClick?: () => void }) {
  const pitchLabel = pitchType ? pitchTypes[pitchType.toString()] || `P${pitchType}` : null;
  const pitchColor = pitchType ? PITCH_TYPE_COLORS[pitchType.toString()] : null;
  const youtubeId = extractYouTubeId(url);

  return (
    <button
      onClick={onClick}
      className="relative aspect-video bg-black rounded-lg overflow-hidden group"
    >
      {youtubeId ? (
        <img
          src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
          alt="Video thumbnail"
          className="w-full h-full object-cover"
        />
      ) : (
        <video
          src={url}
          className="w-full h-full object-contain"
          preload="metadata"
        />
      )}
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
          <Play className="w-5 h-5 text-primary ml-0.5" />
        </div>
      </div>

      {/* Info */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        {label && (
          <span className="text-xs text-white/90 font-medium">{label}</span>
        )}
        <div className="flex items-center gap-1">
          {pitchLabel && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
              style={{ backgroundColor: pitchColor || 'hsl(var(--primary))' }}
            >
              {pitchLabel}
            </span>
          )}
          {velocity && (
            <span className="px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
              {velocity}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
