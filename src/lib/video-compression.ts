export interface CompressionProgress {
  stage: 'loading' | 'compressing' | 'finalizing';
  progress: number; // 0-100
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  videoBitrate?: number; // in bits per second
  onProgress?: (progress: CompressionProgress) => void;
}

const DEFAULT_OPTIONS: Required<Omit<CompressionOptions, 'onProgress'>> = {
  maxWidth: 1280,
  maxHeight: 720,
  videoBitrate: 2_000_000, // 2 Mbps - good quality, reasonable size
};

export async function compressVideo(
  file: Blob,
  options: CompressionOptions = {}
): Promise<Blob> {
  const { maxWidth, maxHeight, videoBitrate } = { ...DEFAULT_OPTIONS, ...options };
  const { onProgress } = options;

  onProgress?.({ stage: 'loading', progress: 0 });

  // Create video element to read the source
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;

  const videoUrl = URL.createObjectURL(file);

  try {
    // Load video metadata
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = videoUrl;
    });

    // Calculate output dimensions maintaining aspect ratio
    let outputWidth = video.videoWidth;
    let outputHeight = video.videoHeight;

    if (outputWidth > maxWidth) {
      outputHeight = Math.round((outputHeight * maxWidth) / outputWidth);
      outputWidth = maxWidth;
    }
    if (outputHeight > maxHeight) {
      outputWidth = Math.round((outputWidth * maxHeight) / outputHeight);
      outputHeight = maxHeight;
    }

    // Ensure dimensions are even (required for some codecs)
    outputWidth = Math.floor(outputWidth / 2) * 2;
    outputHeight = Math.floor(outputHeight / 2) * 2;

    // If video is already smaller than target and file is under 10MB, skip compression
    if (
      video.videoWidth <= maxWidth &&
      video.videoHeight <= maxHeight &&
      file.size < 10 * 1024 * 1024
    ) {
      onProgress?.({ stage: 'finalizing', progress: 100 });
      return file;
    }

    onProgress?.({ stage: 'loading', progress: 50 });

    // Create canvas for drawing frames
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d')!;

    // Set up MediaRecorder with the canvas stream
    const stream = canvas.captureStream(30); // 30 fps
    
    // Try to use H.264 for better compatibility, fall back to VP8
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=h264')
      ? 'video/webm;codecs=h264'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: videoBitrate,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    onProgress?.({ stage: 'compressing', progress: 0 });

    // Start recording
    recorder.start(100);

    // Play video and draw frames to canvas
    video.currentTime = 0;
    await video.play();

    const duration = video.duration;
    
    await new Promise<void>((resolve) => {
      const drawFrame = () => {
        if (video.ended || video.paused) {
          resolve();
          return;
        }

        ctx.drawImage(video, 0, 0, outputWidth, outputHeight);
        
        const progress = Math.min(99, Math.round((video.currentTime / duration) * 100));
        onProgress?.({ stage: 'compressing', progress });

        requestAnimationFrame(drawFrame);
      };

      video.onended = () => resolve();
      drawFrame();
    });

    // Stop recording and wait for final data
    onProgress?.({ stage: 'finalizing', progress: 0 });
    
    const compressedBlob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(blob);
      };
      recorder.stop();
    });

    onProgress?.({ stage: 'finalizing', progress: 100 });

    // Only use compressed version if it's actually smaller
    if (compressedBlob.size < file.size) {
      console.log(
        `Video compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`
      );
      return compressedBlob;
    } else {
      console.log('Compressed video was larger, using original');
      return file;
    }
  } finally {
    URL.revokeObjectURL(videoUrl);
    video.remove();
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
