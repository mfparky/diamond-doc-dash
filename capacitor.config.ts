import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.b57a43b68318479c96da6380890dc2ca',
  appName: 'diamond-doc-dash',
  webDir: 'dist',
  server: {
    url: 'https://b57a43b6-8318-479c-96da-6380890dc2ca.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      iosPermissions: ['camera', 'microphone', 'photos']
    }
  },
  ios: {
    // These are the Info.plist keys that need to be set
    // NSCameraUsageDescription - for camera access
    // NSMicrophoneUsageDescription - for audio recording
    // NSPhotoLibraryAddUsageDescription - for saving to camera roll
    // NSPhotoLibraryUsageDescription - for reading from photo library
  }
};

export default config;
