/// <reference types='vitest' />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const frontendPort = Number(env.FRONTEND_PORT || 4200);

  return {
    root: import.meta.dirname,
    cacheDir: '../../node_modules/.vite/apps/frontend',
    server: {
      port: frontendPort,
      host: 'localhost',
    },
    preview: {
      port: frontendPort,
      host: 'localhost',
    },
    plugins: [react(), tsconfigPaths({ root: '../..' })],
    build: {
      outDir: '../../dist/apps/frontend',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  };
});
