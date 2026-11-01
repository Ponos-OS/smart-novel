import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ComponentType } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import { ContentStatsCards } from './ContentStatsCards';

const DAY = 24 * 60 * 60 * 1000;

function daysUntilYesterday(count: number) {
  const startOfToday = new Date().setUTCHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const day = new Date(startOfToday - (count - index) * DAY);

    return {
      id: `snapshot-${day.toISOString().slice(0, 10)}`,
      day: day.toISOString(),
      novelCount: 600 + index * 7 + (index % 3),
      chapterCount: 6900 + index * 83 + (index % 5) * 4,
    };
  });
}

const stats = {
  contentStats: {
    estimatedNovelCount: 1236,
    estimatedChapterCount: 14420,
  },
};

const snapshots = (nodes: object[]) => ({
  statsSnapshotsConnection: {
    edges: nodes.map((node) => ({ node })),
  },
});

type Outcome = 'pending' | 'failed';

/** @description What the API would answer is put in the query cache, so the stories need no API. A query that cannot answer is started before the cards mount so that it joins it. */
function decorator(
  history: object[] | Outcome,
  live: typeof stats | Outcome = stats,
) {
  return function Decorator(Story: ComponentType) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: Infinity, retry: false },
      },
    });
    const prime = (queryKey: unknown[], value: unknown) => {
      if (typeof value !== 'string') {
        client.setQueryData(queryKey, value);

        return;
      }

      void client.prefetchQuery({
        queryKey,
        queryFn: () =>
          value === 'pending'
            ? new Promise(() => undefined)
            : Promise.reject(new Error('The API is not reachable')),
      });
    };

    prime(['ContentStats'], live);

    for (const last of [30, 90]) {
      prime(
        ['StatsSnapshots', { last }],
        typeof history === 'string'
          ? history
          : snapshots(history.slice(-last)),
      );
    }

    return (
      <QueryClientProvider client={client}>
        <div className="mx-auto max-w-6xl p-6">
          <Story />
        </div>
      </QueryClientProvider>
    );
  };
}

const meta: Meta<typeof ContentStatsCards> = {
  component: ContentStatsCards,
  title: 'Admin/ContentStatsCards',
  decorators: [decorator(daysUntilYesterday(90))],
};

export default meta;

type Story = StoryObj<typeof ContentStatsCards>;

export const Populated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('~1.2k')).toBeVisible();
    await expect(canvas.getByText('~14k')).toBeVisible();
    await expect(
      canvas.getByRole('img', {
        name: 'Novels over the last 30 days',
      }),
    ).toBeVisible();
  },
};

export const NinetyDays: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getAllByRole('button', { name: '90 days' })[0],
    );

    await expect(
      await canvas.findByRole('img', {
        name: 'Novels over the last 90 days',
      }),
    ).toBeVisible();
  },
};

export const TextTable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getAllByText('Show the values as a table')[0],
    );

    await expect(
      canvas.getByRole('table', { name: 'Novels per day' }),
    ).toBeVisible();
  },
};

export const SingleDay: Story = {
  decorators: [decorator([])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getAllByText('The history builds up daily.')[0],
    ).toBeVisible();
  },
};

export const Loading: Story = {
  decorators: [decorator('pending', 'pending')],
};

export const Failed: Story = {
  decorators: [decorator('failed', 'failed')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      await canvas.findByText(
        'The novels history could not be loaded.',
      ),
    ).toBeVisible();
  },
};
