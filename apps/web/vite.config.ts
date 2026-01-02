import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Map @shared/core to the shared package (npm package name)
      '@shared/core': resolve(__dirname, '../../packages/shared/src'),
      // Map @shared/types and @shared/utils for direct subpath access
      '@shared/types': resolve(__dirname, '../../packages/shared/src/types'),
      '@shared/utils': resolve(__dirname, '../../packages/shared/src/utils'),
      // Fallback for @shared
      '@shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    watch: {
      // Debounce file change events to prevent rapid restarts during mass edits
      // Wait 1000ms after the last change before triggering a rebuild
      usePolling: false,
    },
    hmr: {
      // Use overlay for errors but don't spam on rapid changes
      overlay: true,
    },
    proxy: {
      // Proxy /api requests to the backend server for local development.
      // This is needed for local file serving (logos, uploads) since
      // LocalStorageAdapter generates URLs using APP_URL which points to frontend.
      '/api/files': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
