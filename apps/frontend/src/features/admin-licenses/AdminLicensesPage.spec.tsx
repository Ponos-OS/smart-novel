import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  LicenseScope,
  LicenseSourceType,
} from '../../generated/graphql';
import { showSuccess } from '../../utils/notification';
import { AdminLicensesPage } from './AdminLicensesPage';
import { useAdminLicenses } from './use-admin-licenses';

const mutations = vi.hoisted(() => ({
  setDefault: { mutate: vi.fn(), reset: vi.fn(), isPending: false },
}));
let auth: { user: { roles: string[] } | null; loading: boolean };

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock('./use-admin-licenses', () => ({
  ADMIN_LICENSES_KEY: 'AdminLicensesInfinite',
  useAdminLicenses: vi.fn(),
}));
vi.mock('./CreateLicenseDialog', () => ({
  CreateLicenseDialog: ({
    onCreated,
    onClose,
  }: {
    onCreated: () => void;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Create a license">
      <button onClick={onCreated}>Created</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useSetDefaultLicenseMutation: () => mutations.setDefault,
}));

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

function mockLicenses(
  overrides: Partial<ReturnType<typeof useAdminLicenses>> = {},
) {
  const loadMore = vi.fn();

  vi.mocked(useAdminLicenses).mockReturnValue({
    licenses: [ccBy, noResale, writersOwn, writersDraft],
    isLoading: false,
    isError: false,
    isFetching: false,
    hasMore: false,
    isLoadingMore: false,
    loadMore,
    ...overrides,
  });

  return { loadMore };
}

function renderPage() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');

  render(
    <QueryClientProvider client={client}>
      <AdminLicensesPage />
    </QueryClientProvider>,
  );

  return { invalidate, user: userEvent.setup() };
}

const rowOf = (name: string) =>
  screen.getByRole('row', { name: new RegExp(name) });

describe('AdminLicensesPage', () => {
  beforeEach(() => {
    auth = { user: { roles: ['admin'] }, loading: false };
    mutations.setDefault.mutate.mockReset();
    mutations.setDefault.reset.mockReset();
    mutations.setDefault.isPending = false;
    vi.mocked(showSuccess).mockReset();
    mockLicenses();
  });

  describe('access', () => {
    it.each([
      { who: 'a writer', roles: ['writer'] },
      { who: 'a plain user', roles: ['user'] },
    ])(
      'should tell $who they cannot manage licenses, and not fetch any',
      ({ roles }) => {
        auth = { user: { roles }, loading: false };

        renderPage();

        expect(
          screen.getByText(
            /don't have permission to manage licenses/,
          ),
        ).toBeInTheDocument();
        expect(useAdminLicenses).toHaveBeenLastCalledWith(
          '',
          null,
          false,
        );
      },
    );
  });

  describe('list', () => {
    it('shows the scope, default badge, source and owner of every license', () => {
      renderPage();

      expect(rowOf('CC BY 4.0')).toHaveTextContent('Shared');
      expect(rowOf('CC BY 4.0')).toHaveTextContent('Default');
      expect(rowOf('CC BY 4.0')).toHaveTextContent('Canonical');
      expect(rowOf('CC BY 4.0')).toHaveTextContent('Platform');
      expect(rowOf('Only for my fans')).toHaveTextContent('Personal');
      expect(rowOf('Only for my fans')).toHaveTextContent(
        writersOwn.ownerId,
      );
      expect(rowOf('Untitled draft')).toHaveTextContent('Draft');
    });

    it('offers "Set as default" only on a shared license that is not the default', () => {
      renderPage();

      expect(
        within(rowOf('Read it, do not copy it')).getByRole('button', {
          name: 'Set as default',
        }),
      ).toBeVisible();
      expect(
        screen.getAllByRole('button', { name: 'Set as default' }),
      ).toHaveLength(1);
    });

    it('says so when nothing matches', () => {
      mockLicenses({ licenses: [] });

      renderPage();

      expect(screen.getByText('No license matches.')).toBeVisible();
    });

    it('shows an error when the licenses cannot be fetched', () => {
      mockLicenses({ licenses: [], isError: true });

      renderPage();

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to fetch the licenses',
      );
    });

    it('loads the next page', async () => {
      const { loadMore } = mockLicenses({ hasMore: true });
      const { user } = renderPage();

      await user.click(
        screen.getByRole('button', { name: 'Load more' }),
      );

      expect(loadMore).toHaveBeenCalledOnce();
    });
  });

  describe('filters', () => {
    it('asks for one scope when the admin picks it', async () => {
      const { user } = renderPage();

      await user.click(screen.getByRole('radio', { name: 'Draft' }));

      expect(useAdminLicenses).toHaveBeenLastCalledWith(
        '',
        LicenseScope.Draft,
        true,
      );
    });

    it('searches by name after the admin stops typing', async () => {
      const { user } = renderPage();

      await user.type(
        screen.getByRole('searchbox', { name: 'Search licenses' }),
        'cc by',
      );

      await waitFor(() =>
        expect(useAdminLicenses).toHaveBeenLastCalledWith(
          'cc by',
          null,
          true,
        ),
      );
    });
  });

  describe('set as default', () => {
    it('asks first, then changes the default and refreshes the list', async () => {
      mutations.setDefault.mutate.mockImplementation(
        (_, { onSuccess }) => onSuccess(),
      );
      const { user, invalidate } = renderPage();

      await user.click(
        within(rowOf('Read it, do not copy it')).getByRole('button', {
          name: 'Set as default',
        }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Change default' }),
      );

      expect(mutations.setDefault.mutate).toHaveBeenCalledWith(
        { input: { licenseId: noResale.id } },
        expect.anything(),
      );
      expect(showSuccess).toHaveBeenCalledWith(
        'The default license was changed.',
      );
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['AdminLicensesInfinite'],
      });
    });

    it('changes nothing when the admin cancels', async () => {
      const { user } = renderPage();

      await user.click(
        screen.getByRole('button', { name: 'Set as default' }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Cancel' }),
      );

      expect(mutations.setDefault.mutate).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('opens the dialog and refreshes the list once a license was created', async () => {
      const { user, invalidate } = renderPage();

      await user.click(
        screen.getByRole('button', { name: 'Create license' }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Created' }),
      );

      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['AdminLicensesInfinite'],
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
