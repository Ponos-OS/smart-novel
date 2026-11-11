// @ts-check

import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  jsxA11y.flatConfigs.recommended,
  reactHooks.configs.flat.recommended,
  {
    settings: { react: { version: 'detect' } },
    rules: {
      'react/no-unescaped-entities': 'off',
      'react/prop-types': 'off',
      'jsx-a11y/media-has-caption': 'off',
      'jsx-a11y/no-noninteractive-tabindex': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
    },
  },
  {
    ignores: ['src/generated/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['vitest.setup.ts', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
];
