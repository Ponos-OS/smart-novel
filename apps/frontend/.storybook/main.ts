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
    viteConfig.plugins.push(mockChapterContentEditorGraphql());
    return viteConfig;
  },
};

function getAbsolutePath(value: string): string {
  return dirname(
    fileURLToPath(import.meta.resolve(`${value}/package.json`)),
  );
}

function mockChapterContentEditorGraphql(): Plugin {
  const chapterContentEditorPath = resolve(
    dirnamePath,
    '../src/pages/novel/ChapterContentEditor.tsx',
  );
  const realPath = resolve(
    dirnamePath,
    '../src/generated/graphql.ts',
  );
  const mockPath = resolve(
    dirnamePath,
    './mocks/chapter-content-editor.mock.ts',
  );

  return {
    name: 'mock-chapter-content-editor-graphql',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (importer !== chapterContentEditorPath) {
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
