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
import { expect, userEvent, within } from 'storybook/test';

import { CategoryStatus } from '../../generated/graphql';
import { AdminCategoriesPage } from './AdminCategoriesPage';
import { ADMIN_CATEGORIES_KEY } from './use-admin-categories';

const fantasy = {
  id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
  name: 'fantasy',
  status: CategoryStatus.Approved,
  requesterUserId: null,
  approximateNovelCount: 1203,
};
const mystery = {
  id: '8e9a1b6d-3f47-4c20-b5a8-7d6c2e1f0a93',
  name: 'mystery',
  status: CategoryStatus.Approved,
  requesterUserId: null,
  approximateNovelCount: 87,
};
const sliceOfLife = {
  id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
  name: 'slice of life',
  status: CategoryStatus.Pending,
  requesterUserId: '300311094522198754',
  approximateNovelCount: 1,
};

const page = (nodes: object[], hasNextPage = false) => ({
  pages: [
    {
      categoriesConnection: {
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

/** @description The list comes from the query cache and the mutations are mocked, so the stories need no API. */
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
    const all = [CategoryStatus.Approved, CategoryStatus.Pending];

    client.setQueryData(
      [ADMIN_CATEGORIES_KEY, '', all],
      page(nodes, hasMore),
    );
    client.setQueryData(
      [ADMIN_CATEGORIES_KEY, '', [CategoryStatus.Pending]],
      page(nodes.filter((node) => node === sliceOfLife)),
    );

    return (
      <AuthContext.Provider value={authAs(roles)}>
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      </AuthContext.Provider>
    );
  };
}

const meta: Meta<typeof AdminCategoriesPage> = {
  component: AdminCategoriesPage,
  title: 'Admin/AdminCategoriesPage',
  decorators: [
    decorator(['admin'], [fantasy, mystery, sliceOfLife], true),
  ],
};

export default meta;

type Story = StoryObj<typeof AdminCategoriesPage>;

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('~1,203')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Approve slice of life' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Load more' }),
    ).toBeVisible();
  },
};

export const PendingOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Pending' }),
    );

    await expect(
      await canvas.findByText('slice of life'),
    ).toBeVisible();
    await expect(
      canvas.queryByText('fantasy'),
    ).not.toBeInTheDocument();
  },
};

export const Editing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit category fantasy' }),
    );

    await expect(
      canvas.getByLabelText('New name of fantasy'),
    ).toHaveFocus();
  },
};

export const DeleteApproved: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Delete category fantasy' }),
    );

    await expect(
      await within(canvasElement.ownerDocument.body).findByText(
        /will be removed from about 1,203 novels/,
      ),
    ).toBeVisible();
  },
};

export const RejectPending: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Delete category slice of life',
      }),
    );

    await expect(
      await within(canvasElement.ownerDocument.body).findByText(
        /will be rejected and removed/,
      ),
    ).toBeVisible();
  },
};

export const NoResult: Story = {
  decorators: [decorator(['admin'], [])],
};

export const NotAnAdmin: Story = {
  decorators: [decorator(['writer'], [fantasy])],
};
