import type { StorybookConfig } from '@storybook/react-vite';
import type { Plugin } from 'vite';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dirnamePath = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
  addons: [],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {
      builder: {
        viteConfigPath: 'vite.config.mts',
      },
    },
  },
  async viteFinal(viteConfig) {
    viteConfig.plugins ??= [];
    viteConfig.plugins.push(
      mockGeneratedGraphql([
        {
          importerPath: '../src/pages/novel/ChapterContentEditor.tsx',
          mockPath: './mocks/chapter-content-editor.mock.ts',
        },
        {
          importerPath: '../src/pages/novel/ChapterCreatePage.tsx',
          mockPath: './mocks/chapter-create-page.mock.ts',
        },
      ]),
    );
    return viteConfig;
  },
};

function getAbsolutePath(value: string): string {
  return dirname(
    fileURLToPath(import.meta.resolve(`${value}/package.json`)),
  );
}

/**
 * @description Swaps `../src/generated/graphql.ts` for a hand-written mock whenever it's
 * imported by one of the given files, so a story can drive mutation states (pending/success/
 * error) without a real GraphQL client.
 */
function mockGeneratedGraphql(
  mocks: { importerPath: string; mockPath: string }[],
): Plugin {
  const realPath = resolve(
    dirnamePath,
    '../src/generated/graphql.ts',
  );
  const mockPathByImporter = new Map(
    mocks.map(({ importerPath, mockPath }) => [
      resolve(dirnamePath, importerPath),
      resolve(dirnamePath, mockPath),
    ]),
  );

  return {
    name: 'mock-generated-graphql',
    enforce: 'pre',
    async resolveId(source, importer) {
      const mockPath = importer
        ? mockPathByImporter.get(importer)
        : undefined;

      if (!mockPath) {
        return null;
      }

      const resolved = await this.resolve(source, importer, {
        skipSelf: true,
      });

      return resolved?.id === realPath ? mockPath : null;
    },
  };
}

export default config;
