/// <reference types="vitest" />
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/shared',
  plugins: [
    tsconfigPaths({ projects: ['../../tsconfig.base.json'] }),
  ],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: '../../coverage/libs/shared',
    },
  },
});
