import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ComponentType } from 'react';
import { fn } from 'storybook/test';

import { NovelState } from '../../generated/graphql';
import { NovelForm } from './NovelForm';

/** @description The category picker reads its suggestions from the query cache, so the stories need no API. */
function SeededQueryDecorator(Story: ComponentType) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false },
    },
  });

  client.setQueryData(['SearchCategoriesInfinite', ''], {
    pages: [
      {
        categoriesConnection: {
          edges: ['adventure', 'fantasy', 'mystery'].map((name) => ({
            node: { id: `id-${name}`, name },
          })),
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    ],
    pageParams: [undefined],
  });

  return (
    <QueryClientProvider client={client}>
      <Story />
    </QueryClientProvider>
  );
}

const meta: Meta<typeof NovelForm> = {
  component: NovelForm,
  title: 'Novel/NovelForm',
  decorators: [SeededQueryDecorator],
  args: {
    submitLabel: 'Create novel',
    isSubmitting: false,
    onSubmit: fn(),
    onCancel: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof NovelForm>;

export const Empty: Story = {};

export const Prefilled: Story = {
  args: {
    submitLabel: 'Save',
    initialValues: {
      name: 'The Lantern Keeper',
      description: 'A lighthouse keeper finds a door in the fog.',
      state: NovelState.Finished,
      categories: ['fantasy', 'adventure'],
    },
  },
};

export const Submitting: Story = {
  args: {
    isSubmitting: true,
    initialValues: {
      name: 'The Lantern Keeper',
      description: 'A lighthouse keeper finds a door in the fog.',
      state: NovelState.Ongoing,
      categories: ['fantasy'],
    },
  },
};
