import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/backend-e2e',
  plugins: [nxViteTsPaths()],
  test: {
    // Make globals like describe, it, expect available without imports
    globals: true,

    // Node environment for backend e2e tests
    environment: 'node',

    // Load custom matchers and any globals
    setupFiles: ['./vitest.setup.ts'],

    // Global setup and teardown
    globalSetup: ['./src/support/global-setup.ts'],

    // Reporter configuration for better output visibility
    reporters: ['verbose'],

    // Coverage (optional but common)
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: '../../coverage/apps/backend-e2e',
    },

    // The spec files share one Redis status channel and the same chapters
    fileParallelism: false,

    // Test file patterns
    include: ['src/backend/**/*.e2e-spec.ts'],
  },
});
