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

import {
  LicenseScope,
  LicenseSourceType,
  useDefaultLicenseQuery,
} from '../../generated/graphql';
import { LicensesTab } from './LicensesTab';
import { LICENSES_KEY } from './use-licenses';

const ccBy = {
  id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
  name: 'CC BY 4.0',
  scope: LicenseScope.Shared,
  isDefault: true,
  sourceType: LicenseSourceType.Canonical,
  canonicalId: 'CC-BY-4.0',
  officialUrl:
    'https://creativecommons.org/licenses/by/4.0/legalcode',
  text: 'Attribution 4.0 International',
  updatedAt: '2026-10-30T09:15:00.000Z',
};
const mine = {
  id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
  name: 'Only for my fans',
  scope: LicenseScope.Personal,
  isDefault: false,
  sourceType: LicenseSourceType.Custom,
  canonicalId: null,
  officialUrl: null,
  text: 'You may read this novel. You may not copy it.',
  updatedAt: '2026-11-01T10:00:00.000Z',
};
const draft = {
  ...mine,
  id: '8e9a1b6d-3f47-4c20-b5a8-7d6c2e1f0a93',
  name: '',
  scope: LicenseScope.Draft,
  text: '',
};

const authAs = (roles: string[]) =>
  ({
    isLoading: false,
    isAuthenticated: true,
    user: {
      profile: {
        sub: '230104087265432001',
        'urn:zitadel:iam:org:project:roles': Object.fromEntries(
          roles.map((role) => [role, {}]),
        ),
      },
    },
  }) as unknown as AuthContextProps;

/** @description The data comes from the query cache, so the stories need no API. */
function decorator(roles: string[], nodes: object[]) {
  return function Decorator(Story: ComponentType) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: Infinity, retry: false },
      },
    });

    client.setQueryData([LICENSES_KEY, ''], {
      pages: [
        {
          edges: nodes.map((node) => ({ node })),
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      ],
      pageParams: [undefined],
    });
    client.setQueryData(useDefaultLicenseQuery.getKey(), {
      defaultLicense: ccBy,
    });

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

const meta: Meta<typeof LicensesTab> = {
  component: LicensesTab,
  title: 'Licenses/LicensesTab',
  decorators: [decorator(['writer'], [ccBy, mine, draft])],
};

export default meta;

type Story = StoryObj<typeof LicensesTab>;

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Default')).toBeVisible();
    await expect(canvas.getByText('Your draft')).toBeVisible();
    await expect(
      canvas.queryByRole('link', { name: 'Manage licenses' }),
    ).not.toBeInTheDocument();
  },
};

export const ReadTheDefault: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getAllByRole('button', { name: 'CC BY 4.0' })[0],
    );

    await expect(
      await within(canvasElement.ownerDocument.body).findByText(
        'Attribution 4.0 International',
      ),
    ).toBeVisible();
  },
};

export const AsAnAdmin: Story = {
  decorators: [decorator(['admin'], [ccBy, mine])],
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('link', {
        name: 'Manage licenses',
      }),
    ).toBeVisible();
  },
};

export const NoResult: Story = {
  decorators: [decorator(['writer'], [])],
};
