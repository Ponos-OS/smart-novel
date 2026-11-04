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

import {
  LicenseScope,
  LicenseSourceType,
} from '../../generated/graphql';
import { AdminLicensesPage } from './AdminLicensesPage';
import { ADMIN_LICENSES_KEY } from './use-admin-licenses';

const ccBy = {
  id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
  name: 'CC BY 4.0',
  scope: LicenseScope.Shared,
  isDefault: true,
  sourceType: LicenseSourceType.Canonical,
  canonicalId: 'CC-BY-4.0',
  ownerId: 'system',
  updatedAt: '2026-10-30T09:15:00.000Z',
};
const noResale = {
  id: 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42',
  name: 'Read it, do not copy it',
  scope: LicenseScope.Shared,
  isDefault: false,
  sourceType: LicenseSourceType.Custom,
  canonicalId: null,
  ownerId: 'system',
  updatedAt: '2026-10-31T08:00:00.000Z',
};
const writersOwn = {
  id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
  name: 'Only for my fans',
  scope: LicenseScope.Personal,
  isDefault: false,
  sourceType: LicenseSourceType.Custom,
  canonicalId: null,
  ownerId: '230104087265432001',
  updatedAt: '2026-11-01T10:00:00.000Z',
};
const writersDraft = {
  ...writersOwn,
  id: '8e9a1b6d-3f47-4c20-b5a8-7d6c2e1f0a93',
  name: '',
  scope: LicenseScope.Draft,
};

const page = (nodes: object[], hasNextPage = false) => ({
  pages: [
    {
      licensesConnection: {
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

/** @description The list comes from the query cache, so the stories need no API. */
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
      [ADMIN_LICENSES_KEY, '', null],
      page(nodes, hasMore),
    );
    client.setQueryData(
      [ADMIN_LICENSES_KEY, '', LicenseScope.Draft],
      page(nodes.filter((node) => node === writersDraft)),
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

const meta: Meta<typeof AdminLicensesPage> = {
  component: AdminLicensesPage,
  title: 'Admin/AdminLicensesPage',
  decorators: [
    decorator(
      ['admin'],
      [ccBy, noResale, writersOwn, writersDraft],
      true,
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof AdminLicensesPage>;

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Default')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Set as default' }),
    ).toBeVisible();
    await expect(canvas.getByText('Untitled draft')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Load more' }),
    ).toBeVisible();
  },
};

export const DraftsOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('radio', { name: 'Draft' }),
    );

    await expect(
      await canvas.findByText('Untitled draft'),
    ).toBeVisible();
    await expect(
      canvas.queryByText('CC BY 4.0'),
    ).not.toBeInTheDocument();
  },
};

export const ConfirmDefault: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Set as default' }),
    );

    await expect(
      await within(canvasElement.ownerDocument.body).findByText(
        /Every new novel without a chosen license will get "Read it, do not copy it"/,
      ),
    ).toBeVisible();
  },
};

export const NoResult: Story = {
  decorators: [decorator(['admin'], [])],
};

export const NotAnAdmin: Story = {
  decorators: [decorator(['writer'], [ccBy])],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(
        /don't have permission to manage licenses/,
      ),
    ).toBeVisible();
  },
};
