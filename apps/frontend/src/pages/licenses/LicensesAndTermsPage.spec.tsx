import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { LicensesAndTermsPage } from './LicensesAndTermsPage';

let auth: { user: { roles: string[] } | null; loading: boolean };

const status = {
  requiredVersion: 1,
  acceptedVersion: 1,
  accepted: true,
  acceptedAt: '2026-10-29T09:30:00.000Z',
};

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));

vi.mock('../../features/license-list/LicensesTab', () => ({
  LicensesTab: () => <p>The list of licenses</p>,
}));

vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  usePlatformTermsQuery: () => ({
    data: {
      platformTerms: {
        version: 1,
        markdown:
          'You grant the platform a license to host your work.',
      },
    },
    isLoading: false,
  }),
  useMyPlatformTermsStatusQuery: () => ({
    data: { myPlatformTermsStatus: status },
  }),
}));

function renderPage() {
  render(
    <MemoryRouter>
      <LicensesAndTermsPage />
    </MemoryRouter>,
  );
}

describe(LicensesAndTermsPage.name, () => {
  beforeEach(() => {
    auth = { user: { roles: ['writer'] }, loading: false };
  });

  it('refuses a reader', () => {
    // Arrange
    auth = { user: { roles: ['reader'] }, loading: false };

    // Act
    renderPage();

    // Assert
    expect(
      screen.getByText(/Only writers can see/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('links to the license assistant', () => {
    // Act
    renderPage();

    // Assert
    expect(
      screen.getByRole('link', {
        name: 'Draft a license with the assistant',
      }),
    ).toHaveAttribute('href', '/licenses/draft');
  });

  it('opens on the list of licenses', () => {
    // Act
    renderPage();

    // Assert
    expect(
      screen.getByRole('tab', { name: 'Licenses' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'The list of licenses',
    );
  });

  it('shows the platform terms with the date they were accepted on the second tab', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPage();

    // Act
    await user.click(
      screen.getByRole('tab', { name: 'Platform terms' }),
    );

    // Assert
    expect(
      screen.getByText(/license to host your work/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You accepted these terms on/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        new Date(status.acceptedAt).toLocaleDateString(),
      ),
    ).toHaveAttribute('datetime', status.acceptedAt);
  });

  it('has no tab for the default license any more', () => {
    // Act
    renderPage();

    // Assert
    expect(
      screen.queryByRole('tab', { name: 'Default license' }),
    ).not.toBeInTheDocument();
  });

  it('switches tabs with the arrow keys', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPage();
    screen.getByRole('tab', { name: 'Licenses' }).focus();

    // Act
    await user.keyboard('{ArrowRight}');

    // Assert
    expect(
      screen.getByRole('tab', { name: 'Platform terms' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('tab', { name: 'Platform terms' }),
    ).toHaveFocus();
  });
});
