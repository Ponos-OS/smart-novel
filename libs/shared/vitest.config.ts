/// <reference types="vitest" />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/shared',
  plugins: [nxViteTsPaths()],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: '../../coverage/libs/shared',
    },
  },
});
