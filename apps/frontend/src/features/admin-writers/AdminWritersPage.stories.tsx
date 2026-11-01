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

import { WriterStatus } from '../../generated/graphql';
import { AdminWritersPage } from './AdminWritersPage';
import { ADMIN_WRITERS_KEY } from './use-admin-writers';

const mina = {
  id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
  name: 'Mina Ardalan',
  email: 'mina.ardalan@example.com',
  note: 'I serialize a fantasy web novel and would like to move it here.',
  status: WriterStatus.Pending,
  rejectionReason: null,
  createdAt: '2026-10-30T09:15:00.000Z',
  reviewedAt: null,
};
const omid = {
  id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
  name: 'Omid Rahimi',
  email: 'omid.rahimi@example.com',
  note: 'I would like to publish poems.',
  status: WriterStatus.Pending,
  rejectionReason: null,
  createdAt: '2026-10-31T08:00:00.000Z',
  reviewedAt: null,
};
const sara = {
  id: '8e9a1b6d-3f47-4c20-b5a8-7d6c2e1f0a93',
  name: 'Sara Karimi',
  email: 'sara.karimi@example.com',
  note: 'Short stories.',
  status: WriterStatus.Rejected,
  rejectionReason: 'Please share a sample chapter.',
  createdAt: '2026-10-20T10:00:00.000Z',
  reviewedAt: '2026-10-21T10:00:00.000Z',
};

const page = (nodes: object[], hasNextPage = false) => ({
  pages: [
    {
      writersConnection: {
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

/** @description The lists come from the query cache and the mutations are mocked, so the stories need no API. */
function decorator(
  roles: string[],
  pending: object[],
  hasMore = false,
) {
  return function Decorator(Story: ComponentType) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: Infinity, retry: false },
      },
    });

    client.setQueryData(
      [ADMIN_WRITERS_KEY, WriterStatus.Pending],
      page(pending, hasMore),
    );
    client.setQueryData(
      [ADMIN_WRITERS_KEY, WriterStatus.Rejected],
      page([sara]),
    );
    client.setQueryData(
      [ADMIN_WRITERS_KEY, WriterStatus.Approved],
      page([]),
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

const meta: Meta<typeof AdminWritersPage> = {
  component: AdminWritersPage,
  title: 'Admin/AdminWritersPage',
  decorators: [decorator(['admin'], [mina, omid], true)],
};

export default meta;

type Story = StoryObj<typeof AdminWritersPage>;

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Mina Ardalan')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Approve Mina Ardalan' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Load more' }),
    ).toBeVisible();
  },
};

export const RejectedHistory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('radio', { name: 'Rejected' }),
    );

    await expect(
      await canvas.findByText('Please share a sample chapter.'),
    ).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: /Approve/ }),
    ).not.toBeInTheDocument();
  },
};

export const RejectDialog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Reject Mina Ardalan' }),
    );

    await expect(
      await within(canvasElement.ownerDocument.body).findByLabelText(
        'Reason (optional)',
      ),
    ).toBeVisible();
  },
};

export const NoPendingRequests: Story = {
  decorators: [decorator(['admin'], [])],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('No pending requests.'),
    ).toBeVisible();
  },
};

export const NotAnAdmin: Story = {
  decorators: [decorator(['writer'], [mina])],
};
