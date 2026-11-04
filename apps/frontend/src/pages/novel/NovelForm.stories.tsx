import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ComponentType } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import {
  LicenseScope,
  LicenseSourceType,
  NovelState,
  useCanonicalLicensesQuery,
  useSelectableLicensesQuery,
} from '../../generated/graphql';
import { NovelForm } from './NovelForm';

/** @description The tag picker reads its suggestions from the query cache, so the stories need no API. */
function SeededQueryDecorator(Story: ComponentType) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, retry: false },
    },
  });

  client.setQueryData(['SearchTagsInfinite', ''], {
    pages: [
      {
        tagsConnection: {
          edges: ['adventure', 'fantasy', 'mystery'].map((name) => ({
            node: { id: `id-${name}`, name },
          })),
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    ],
    pageParams: [undefined],
  });

  client.setQueryData(useCanonicalLicensesQuery.getKey(), {
    canonicalLicenses: [],
  });
  client.setQueryData(
    useSelectableLicensesQuery.getKey({
      scope: LicenseScope.Shared,
      first: 100,
    }),
    {
      licensesConnection: {
        edges: [
          {
            node: {
              id: 'e7a1c9d2-5b34-4f68-8c01-6d2f4a9b3e17',
              name: 'Read it, do not copy it',
              sourceType: LicenseSourceType.Custom,
              canonicalId: null,
              officialUrl: null,
              text: 'You may read this novel. You may not copy it.',
            },
          },
        ],
      },
    },
  );
  client.setQueryData(
    useSelectableLicensesQuery.getKey({
      scope: LicenseScope.Personal,
      first: 100,
    }),
    { licensesConnection: { edges: [] } },
  );

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
      tags: ['fantasy', 'adventure'],
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
      tags: ['fantasy'],
    },
  },
};

export const PickingASharedLicense: Story = {
  args: {
    license: {
      id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
      name: 'CC BY 4.0',
      sourceType: LicenseSourceType.Canonical,
      canonicalId: 'CC-BY-4.0',
      text: 'Attribution 4.0 International',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.selectOptions(
      canvas.getByLabelText('Start from'),
      canvas.getByRole('option', { name: 'Read it, do not copy it' }),
    );

    await expect(canvas.getByLabelText('License text')).toHaveValue(
      'You may read this novel. You may not copy it.',
    );
  },
};
