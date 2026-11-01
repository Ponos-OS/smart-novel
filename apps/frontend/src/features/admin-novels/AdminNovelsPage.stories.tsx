import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ComponentType } from 'react';
import {
  AuthContext,
  type AuthContextProps,
} from 'react-oidc-context';
import { MemoryRouter } from 'react-router-dom';
import { expect, userEvent, within } from 'storybook/test';

import { NovelState } from '../../generated/graphql';
import { AdminNovelsPage } from './AdminNovelsPage';
import { ADMIN_NOVELS_KEY } from './use-admin-novels';

const mina = {
  userId: '364554362883670018',
  penName: 'Mina_Ardalan',
  name: 'Mina Ardalan',
  email: 'mina.ardalan@example.com',
};
const omid = {
  userId: '364554362732740610',
  penName: 'Omid_Rahimi',
  name: 'Omid Rahimi',
  email: 'omid.rahimi@example.com',
};
const lantern = {
  id: 'c1d31ec2-f478-4648-b90b-d1e53de2a829',
  name: 'The Lantern Keeper',
  state: NovelState.Ongoing,
  firstChapterCreatedAt: '2026-10-30T09:15:00.000Z',
  estimatedChapterCount: 1203,
  license: { id: '3f7b0c1e', name: 'CC BY 4.0' },
  writer: mina,
};
const saltRoad = {
  id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
  name: 'The Salt Road',
  state: NovelState.Finished,
  firstChapterCreatedAt: null,
  estimatedChapterCount: 1,
  license: { id: '8e9a1b6d', name: 'CC0 1.0' },
  writer: omid,
};
const noName = {
  ...lantern,
  id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
  name: 'Echoes in the Dark',
  writer: { userId: '364554362111111111', penName: 'Echo_Writer' },
};

const novelsPage = (nodes: object[], hasNextPage = false) => ({
  pages: [
    {
      novelsConnection: {
        edges: nodes.map((node) => ({ node })),
        pageInfo: {
          endCursor: hasNextPage ? 'cursor-1' : null,
          hasNextPage,
        },
      },
    },
  ],
  pageParams: [undefined],
});

const writersPage = (nodes: object[]) => ({
  pages: [
    {
      writersConnection: {
        edges: nodes.map((node) => ({ node })),
        pageInfo: { endCursor: null, hasNextPage: false },
      },
    },
  ],
  pageParams: [undefined],
});

/** @description The content stats cards have their own stories; here they only need an answer. */
function primeContentStatsCards(client: QueryClient) {
  client.setQueryData(['ContentStats'], {
    contentStats: {
      estimatedNovelCount: 1236,
      estimatedChapterCount: 14420,
    },
  });
  for (const last of [30, 90]) {
    client.setQueryData(['StatsSnapshots', { last }], {
      statsSnapshotsConnection: { edges: [] },
    });
  }
}

const authAs = (roles: string[]) =>
  ({
    isLoading: false,
    isAuthenticated: true,
    user: {
      profile: {
        sub: '240311094522198754',
        'urn:zitadel:iam:org:project:roles': Object.fromEntries(
          roles.map((role) => [role, {}]),
        ),
      },
    },
  }) as unknown as AuthContextProps;

/** @description The list and the writer suggestions come from the query cache and the delete is mocked, so the stories need no API. */
function decorator(
  roles: string[],
  nodes: object[],
  hasMore = false,
) {
  return function Decorator(Story: ComponentType) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: Infinity, retry: false },
      },
    });

    client.setQueryData(
      [ADMIN_NOVELS_KEY, undefined, undefined],
      novelsPage(nodes, hasMore),
    );
    client.setQueryData(
      ['SearchWritersInfinite', ''],
      writersPage([mina, omid]),
    );
    primeContentStatsCards(client);

    return (
      <AuthContext.Provider value={authAs(roles)}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <Story />
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>
    );
  };
}

/** @description A list that has not answered yet, or that cannot: the fetch is started before the page mounts so that it joins it. */
function unavailable(outcome: 'pending' | 'failed') {
  return function Decorator(Story: ComponentType) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: Infinity, retry: false },
      },
    });

    primeContentStatsCards(client);
    void client.prefetchInfiniteQuery({
      queryKey: [ADMIN_NOVELS_KEY, undefined, undefined],
      initialPageParam: undefined,
      queryFn: () =>
        outcome === 'pending'
          ? new Promise(() => undefined)
          : Promise.reject(new Error('The API is not reachable')),
    });

    return (
      <AuthContext.Provider value={authAs(['admin'])}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <Story />
          </MemoryRouter>
        </QueryClientProvider>
      </AuthContext.Provider>
    );
  };
}

const meta: Meta<typeof AdminNovelsPage> = {
  component: AdminNovelsPage,
  title: 'Admin/AdminNovelsPage',
  decorators: [decorator(['admin'], [lantern, saltRoad], true)],
};

export default meta;

type Story = StoryObj<typeof AdminNovelsPage>;

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('~1,203')).toBeVisible();
    await expect(
      canvas.getByText('Mina Ardalan · mina.ardalan@example.com'),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Load more' }),
    ).toBeVisible();
  },
};

export const WriterWithoutDetails: Story = {
  decorators: [decorator(['admin'], [noName])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Echo_Writer')).toBeVisible();
    await expect(
      canvas.getByText('364554362111111111'),
    ).toBeVisible();
  },
};

export const SortedByFirstChapter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Sort by first chapter, oldest first',
      }),
    );

    await expect(
      canvas.getByRole('columnheader', { name: /First chapter/ }),
    ).toHaveAttribute('aria-sort', 'ascending');
  },
};

export const PickingWriters: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('combobox', { name: 'Writers' }),
    );
    await userEvent.click(
      within(await canvas.findByRole('listbox')).getByText(
        'Omid_Rahimi',
      ),
    );

    await expect(
      within(
        canvas.getByRole('list', { name: 'Selected writers' }),
      ).getByText('Omid_Rahimi'),
    ).toBeVisible();
  },
};

export const InvalidRange: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(
      canvas.getByLabelText('Minimum chapters'),
      '10',
    );
    await userEvent.type(
      canvas.getByLabelText('Maximum chapters'),
      '2',
    );

    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'The maximum is below the minimum',
    );
  },
};

export const ConfirmDelete: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Delete The Lantern Keeper',
      }),
    );

    await expect(
      await within(canvasElement.ownerDocument.body).findByText(
        /will be deleted for good/,
      ),
    ).toBeVisible();
  },
};

export const NoResult: Story = {
  decorators: [decorator(['admin'], [])],
};

export const NotAnAdmin: Story = {
  decorators: [decorator(['writer'], [lantern])],
};

export const Loading: Story = {
  decorators: [unavailable('pending')],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('status'),
    ).toHaveTextContent('Loading novels...');
  },
};

export const Failed: Story = {
  decorators: [unavailable('failed')],
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole('alert'),
    ).toHaveTextContent('Failed to fetch the novels');
  },
};
