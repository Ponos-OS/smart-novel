/// <reference types="vitest" />
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/backend-nest',
  plugins: [
    tsconfigPaths({ projects: ['../../tsconfig.base.json'] }),
  ],
  test: {
    // Make globals like describe, it, expect available without imports
    globals: true,

    // Node environment for backend tests
    environment: 'node',

    // Load custom matchers and any globals
    setupFiles: ['./vitest.setup.ts'],

    // Coverage (optional but common)
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: '../../coverage/apps/backend-nest',
    },
  },
});
