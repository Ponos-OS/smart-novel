import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { showSuccess } from '../../utils/notification';
import { AdminDefaultLicensePage } from './AdminDefaultLicensePage';

const mutate = vi.fn();
let auth: { user: { roles: string[] } | null; loading: boolean };

const ccBy = {
  id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
  name: 'CC BY 4.0',
  sourceType: 'CANONICAL',
  canonicalId: 'CC-BY-4.0',
  text: 'Attribution 4.0 International',
};
const ccByNc = {
  id: 'CC-BY-NC-4.0',
  shortName: 'CC BY-NC 4.0',
  officialUrl:
    'https://creativecommons.org/licenses/by-nc/4.0/legalcode',
  body: 'Attribution-NonCommercial 4.0 International',
};
const noResale = {
  ...ccBy,
  id: 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42',
  name: 'CC BY 4.0 without resale',
  sourceType: 'FORKED',
  text: 'Attribution 4.0 International, no resale.',
};

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));

vi.mock('../../utils/notification', () => ({
  showSuccess: vi.fn(),
}));

vi.mock('../../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../../generated/graphql')
  >('../../generated/graphql');
  const useDefaultLicenseQuery = Object.assign(
    () => ({ data: { defaultLicense: ccBy }, isLoading: false }),
    { getKey: actual.useDefaultLicenseQuery.getKey },
  );

  return {
    ...actual,
    useDefaultLicenseQuery,
    useCanonicalLicensesQuery: () => ({
      data: {
        canonicalLicenses: [
          { id: 'CC-BY-NC-4.0', shortName: 'CC BY-NC 4.0' },
        ],
      },
    }),
    useCanonicalLicenseQuery: (
      _variables: unknown,
      { enabled }: { enabled: boolean },
    ) => ({
      data: enabled ? { canonicalLicense: ccByNc } : undefined,
    }),
    useSetDefaultLicenseMutation: () => ({
      mutate,
      reset: vi.fn(),
      isPending: false,
      error: null,
    }),
  };
});

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AdminDefaultLicensePage />
    </QueryClientProvider>,
  );
}

describe(AdminDefaultLicensePage.name, () => {
  beforeEach(() => {
    auth = { user: { roles: ['admin'] }, loading: false };
    vi.clearAllMocks();
  });

  it.each([['writer'], ['reader']])('refuses a %s', (role) => {
    // Arrange
    auth = { user: { roles: [role] }, loading: false };

    // Act
    renderPage();

    // Assert
    expect(
      screen.getByText(/don't have permission/),
    ).toBeInTheDocument();
    expect(screen.queryByText('CC BY 4.0')).not.toBeInTheDocument();
  });

  it('shows the current default and keeps the action disabled until the text changes', () => {
    // Act
    renderPage();

    // Assert
    expect(screen.getByText('CC BY 4.0')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Set as default' }),
    ).toBeDisabled();
  });

  it('changes the default only after the admin confirms', async () => {
    // Arrange
    const user = userEvent.setup();
    mutate.mockImplementation((_variables, options) =>
      options.onSuccess({ setDefaultLicense: noResale }),
    );
    renderPage();
    const textarea = screen.getByLabelText('License text');
    await user.clear(textarea);
    await user.type(textarea, noResale.text);
    await user.type(
      screen.getByLabelText('Name of your modified license'),
      noResale.name,
    );

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Set as default' }),
    );
    const calledBeforeConfirm = mutate.mock.calls.length;
    await user.click(
      screen.getByRole('button', { name: 'Change default' }),
    );

    // Assert
    expect(calledBeforeConfirm).toBe(0);
    expect(mutate).toHaveBeenCalledExactlyOnceWith(
      {
        input: {
          licenseDraft: {
            title: noResale.name,
            text: noResale.text,
            source: { type: 'FORKED', canonicalId: 'CC-BY-4.0' },
          },
        },
      },
      expect.anything(),
    );
    await waitFor(() => expect(showSuccess).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('makes a canonical license of the registry the default, after the admin confirms', async () => {
    // Arrange
    const user = userEvent.setup();
    mutate.mockImplementation((_variables, options) =>
      options.onSuccess({
        setDefaultLicense: { ...ccByNc, name: 'CC BY-NC 4.0' },
      }),
    );
    renderPage();

    // Act
    await user.selectOptions(
      screen.getByLabelText('Start from'),
      'CC-BY-NC-4.0',
    );
    await user.click(
      screen.getByRole('button', { name: 'Set as default' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Change default' }),
    );

    // Assert
    expect(mutate).toHaveBeenCalledExactlyOnceWith(
      {
        input: {
          licenseDraft: {
            title: 'CC BY-NC 4.0',
            text: ccByNc.body,
            source: {
              type: 'CANONICAL',
              canonicalId: 'CC-BY-NC-4.0',
            },
          },
        },
      },
      expect.anything(),
    );
  });

  it('leaves the default alone when the confirmation is cancelled', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('License text'), ' More.');
    await user.type(
      screen.getByLabelText('Name of your modified license'),
      'My terms',
    );
    await user.click(
      screen.getByRole('button', { name: 'Set as default' }),
    );

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
