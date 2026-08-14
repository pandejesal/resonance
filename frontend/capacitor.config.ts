import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pandejesal.resonance',
  appName: 'Resonance',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    url: 'http://127.0.0.1:8080',
    cleartext: true,
    allowNavigation: ['127.0.0.1'],
  },
  plugins: {
    BackendServer: {},
  },
};

export default config;
