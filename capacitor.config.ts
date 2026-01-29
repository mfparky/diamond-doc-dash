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
      // iOS camera permissions
      iosPermissions: ['camera', 'microphone', 'photos']
    }
  }
};

export default config;
