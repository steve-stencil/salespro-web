import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
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
  },
});
