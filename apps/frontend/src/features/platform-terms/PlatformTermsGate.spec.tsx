import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { PlatformTermsGate } from './PlatformTermsGate';
import { reopenOnTermsError } from './reopen-on-terms-error';

const logout = vi.fn();
const fetchMock = vi.fn();
let auth: {
  user: { roles: string[] } | null;
  isAuthenticated: boolean;
};

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ ...auth, logout }),
}));

const terms = {
  version: 1,
  markdown: 'You grant the platform a license to host your work.',
};
const pending = {
  requiredVersion: 1,
  acceptedVersion: null,
  accepted: false,
};
const accepted = { ...pending, acceptedVersion: 1, accepted: true };

function respondWith(handlers: Record<string, unknown>) {
  fetchMock.mockImplementation(async (_url, init) => {
    const { query } = JSON.parse(init.body);
    const operation = Object.keys(handlers).find((name) =>
      query.includes(name),
    );

    return {
      json: async () => ({ data: handlers[operation as string] }),
    };
  });
}

function renderGate(path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <PlatformTermsGate />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return queryClient;
}

describe(PlatformTermsGate.name, () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SERVICE_URL', 'http://localhost:3000');
    vi.stubGlobal('fetch', fetchMock);
    auth = { user: { roles: ['writer'] }, isAuthenticated: true };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows the modal to a writer who has not accepted the terms', async () => {
    // Arrange
    respondWith({
      myPlatformTermsStatus: { myPlatformTermsStatus: pending },
      platformTerms: { platformTerms: terms },
    });

    // Act
    renderGate();

    // Assert
    expect(
      await screen.findByRole('dialog', { name: 'Platform terms' }),
    ).toBeInTheDocument();
  });

  it('steps aside on the licenses page so the writer can read it', async () => {
    // Arrange
    respondWith({
      myPlatformTermsStatus: { myPlatformTermsStatus: pending },
      platformTerms: { platformTerms: terms },
    });

    // Act
    renderGate('/licenses');

    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows nothing when the writer already accepted the terms', async () => {
    // Arrange
    respondWith({
      myPlatformTermsStatus: { myPlatformTermsStatus: accepted },
    });

    // Act
    renderGate();

    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    [
      'a reader',
      { user: { roles: ['reader'] }, isAuthenticated: true },
    ],
    ['an anonymous visitor', { user: null, isAuthenticated: false }],
  ])('does not ask %s or call the API', async (_label, session) => {
    // Arrange
    auth = session;

    // Act
    renderGate();

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts the shown version and unlocks', async () => {
    // Arrange
    respondWith({
      myPlatformTermsStatus: { myPlatformTermsStatus: pending },
      platformTerms: { platformTerms: terms },
      acceptPlatformTerms: { acceptPlatformTerms: accepted },
    });
    const user = userEvent.setup();
    renderGate();
    await user.click(await screen.findByRole('checkbox'));

    // Act
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    // Assert
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    const mutationCall = fetchMock.mock.calls
      .map(([, init]) => JSON.parse(init.body))
      .find(({ query }) => query.includes('mutation'));
    expect(mutationCall.variables).toEqual({ version: 1 });
  });

  it('logs out from the modal', async () => {
    // Arrange
    respondWith({
      myPlatformTermsStatus: { myPlatformTermsStatus: pending },
      platformTerms: { platformTerms: terms },
    });
    const user = userEvent.setup();
    renderGate();

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Log out' }),
    );

    // Assert
    expect(logout).toHaveBeenCalledOnce();
  });

  it('reopens after a not-accepted error from a mutation', async () => {
    // Arrange
    respondWith({
      myPlatformTermsStatus: { myPlatformTermsStatus: accepted },
      platformTerms: { platformTerms: { ...terms, version: 2 } },
    });
    const queryClient = renderGate();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    respondWith({
      myPlatformTermsStatus: {
        myPlatformTermsStatus: { ...pending, requiredVersion: 2 },
      },
      platformTerms: { platformTerms: { ...terms, version: 2 } },
    });

    // Act
    reopenOnTermsError(
      queryClient,
      new GraphqlRequestError('Forbidden', {
        code: 'PLATFORM_TERMS_NOT_ACCEPTED',
      }),
    );

    // Assert
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
