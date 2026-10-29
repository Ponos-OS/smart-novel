import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { LicensesAndTermsPage } from './LicensesAndTermsPage';

let auth: { user: { roles: string[] } | null; loading: boolean };

const defaultLicense = {
  id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
  name: 'CC BY 4.0',
  sourceType: 'CANONICAL',
  canonicalId: 'CC-BY-4.0',
  text: 'Attribution 4.0 International',
};
const status = {
  requiredVersion: 1,
  acceptedVersion: 1,
  accepted: true,
  acceptedAt: '2026-10-29T09:30:00.000Z',
};

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));

vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useDefaultLicenseQuery: () => ({
    data: { defaultLicense },
    isLoading: false,
  }),
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

  it('opens on the platform terms with the date they were accepted', () => {
    // Act
    renderPage();

    // Assert
    expect(
      screen.getByRole('tab', { name: 'Platform terms' }),
    ).toHaveAttribute('aria-selected', 'true');
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

  it('shows the default license text from the API on the second tab', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPage();

    // Act
    await user.click(
      screen.getByRole('tab', { name: 'Default license' }),
    );

    // Assert
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      defaultLicense.text,
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Authors may change it for each of their novels',
    );
    expect(
      screen.queryByText('Change the default license'),
    ).not.toBeInTheDocument();
  });

  it('links an admin to the default-license screen', async () => {
    // Arrange
    auth = { user: { roles: ['admin'] }, loading: false };
    const user = userEvent.setup();
    renderPage();

    // Act
    await user.click(
      screen.getByRole('tab', { name: 'Default license' }),
    );

    // Assert
    expect(
      screen.getByRole('link', {
        name: 'Change the default license',
      }),
    ).toHaveAttribute('href', '/admin/licenses');
  });

  it('switches tabs with the arrow keys', async () => {
    // Arrange
    const user = userEvent.setup();
    renderPage();
    screen.getByRole('tab', { name: 'Platform terms' }).focus();

    // Act
    await user.keyboard('{ArrowRight}');

    // Assert
    expect(
      screen.getByRole('tab', { name: 'Default license' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('tab', { name: 'Default license' }),
    ).toHaveFocus();
  });
});
