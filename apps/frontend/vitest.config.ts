/// <reference types="vitest" />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const VITE_EXPLAIN_SELECTION_DEBOUNCE_MS =
  process.env.VITE_EXPLAIN_SELECTION_DEBOUNCE_MS ?? '500';
const VITE_EXPLAIN_CONTEXT_CHAR_SIZE =
  process.env.VITE_EXPLAIN_CONTEXT_CHAR_SIZE ?? '250';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/frontend',
  plugins: [react(), nxViteTsPaths()],
  test: {
    // Make globals like describe, it, expect available without imports
    globals: true,

    // Browser-like environment for React components
    environment: 'jsdom',

    // Load custom matchers and any globals
    setupFiles: ['./vitest.setup.ts'],

    // If you import CSS or SVGs in components
    css: true,

    // user-event and axe specs exceed the 5s default when every file runs in parallel
    testTimeout: 15000,

    // Coverage (optional but common)
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: '../../coverage/apps/frontend',
    },
  },
  // Define env variables so they work in tests like in the app
  define: {
    'import.meta.env.VITE_EXPLAIN_SELECTION_DEBOUNCE_MS':
      JSON.stringify(VITE_EXPLAIN_SELECTION_DEBOUNCE_MS),
    'import.meta.env.VITE_EXPLAIN_CONTEXT_CHAR_SIZE': JSON.stringify(
      VITE_EXPLAIN_CONTEXT_CHAR_SIZE,
    ),
  },
});
