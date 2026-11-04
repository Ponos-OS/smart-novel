import {
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import {
  LicenseScope,
  LicenseSourceType,
} from '../../generated/graphql';
import { LicensesTab } from './LicensesTab';
import { useLicenses } from './use-licenses';

let auth: { user: { roles: string[] } | null; loading: boolean };

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

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('./use-licenses', () => ({
  LICENSES_KEY: 'LicensesInfinite',
  useLicenses: vi.fn(),
}));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useDefaultLicenseQuery: () => ({ data: { defaultLicense: ccBy } }),
}));

function mockLicenses(
  overrides: Partial<ReturnType<typeof useLicenses>> = {},
) {
  const loadMore = vi.fn();

  vi.mocked(useLicenses).mockReturnValue({
    licenses: [ccBy, mine, draft],
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

function renderTab() {
  render(
    <MemoryRouter>
      <LicensesTab />
    </MemoryRouter>,
  );

  return userEvent.setup();
}

describe(LicensesTab.name, () => {
  beforeEach(() => {
    auth = { user: { roles: ['writer'] }, loading: false };
    mockLicenses();
  });

  it('lists the name, scope, source and last update of every license', () => {
    renderTab();

    const ccByRow = screen.getByRole('row', { name: /CC BY 4.0/ });
    expect(ccByRow).toHaveTextContent('Default');
    expect(ccByRow).toHaveTextContent('Shared');
    expect(ccByRow).toHaveTextContent('CC-BY-4.0');
    expect(
      screen.getByRole('row', { name: /Only for my fans/ }),
    ).toHaveTextContent('YoursCustom');
    expect(
      screen.getByRole('row', { name: /Untitled draft/ }),
    ).toHaveTextContent('Your draft');
  });

  it('opens the text of a license, with the link to the official one', async () => {
    const user = renderTab();

    await user.click(
      within(screen.getByRole('table')).getByRole('button', {
        name: 'CC BY 4.0',
      }),
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Attribution 4.0 International');
    expect(
      within(dialog).getByRole('link', { name: /official license/ }),
    ).toHaveAttribute('href', ccBy.officialUrl);
  });

  it('opens the default license from the link above the table', async () => {
    const user = renderTab();

    await user.click(
      screen.getAllByRole('button', { name: 'CC BY 4.0' })[0],
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Attribution 4.0 International',
    );
  });

  it('says a draft without text has none yet', async () => {
    const user = renderTab();

    await user.click(
      screen.getByRole('button', { name: 'Untitled draft' }),
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'This draft has no text yet.',
    );
  });

  it.each([
    { who: 'an admin', roles: ['admin'], visible: true },
    { who: 'a writer', roles: ['writer'], visible: false },
  ])(
    'should show the link to manage licenses to $who: $visible',
    ({ roles, visible }) => {
      auth = { user: { roles }, loading: false };

      renderTab();

      const link = screen.queryByRole('link', {
        name: 'Manage licenses',
      });
      if (visible) {
        expect(link).toHaveAttribute('href', '/admin/licenses');
      } else {
        expect(link).not.toBeInTheDocument();
      }
    },
  );

  it('searches by name after the writer stops typing', async () => {
    const user = renderTab();

    await user.type(
      screen.getByRole('searchbox', { name: 'Search licenses' }),
      'fans',
    );

    await waitFor(() =>
      expect(useLicenses).toHaveBeenLastCalledWith('fans'),
    );
  });

  it('loads the next page', async () => {
    const { loadMore } = mockLicenses({ hasMore: true });
    const user = renderTab();

    await user.click(
      screen.getByRole('button', { name: 'Load more' }),
    );

    expect(loadMore).toHaveBeenCalledOnce();
  });

  it('shows an error when the licenses cannot be fetched', () => {
    mockLicenses({ licenses: [], isError: true });

    renderTab();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Failed to fetch the licenses',
    );
  });
});
