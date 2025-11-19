import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    // CHANGE THIS: If deploying to https://<USERNAME>.github.io/<REPO>/, set base to '/<REPO>/'
    base: '/Royale-Baccarat/', 
    define: {
      // This polyfills process.env.API_KEY so the code works without changes.
      // In production, this key is embedded in the build.
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || process.env.API_KEY),
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    }
  };
});