import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { showSuccess } from '../../utils/notification';
import { LicenseAssistantPage } from './LicenseAssistantPage';

let auth: { user: { roles: string[] } | null; loading: boolean };

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));

vi.mock('../../utils/notification', () => ({ showSuccess: vi.fn() }));

vi.mock(
  '../../features/license-assistant/LicenseDraftingAssistant',
  () => ({
    LicenseDraftingAssistant: ({
      baseLicense,
      onFinalized,
    }: {
      baseLicense?: unknown;
      onFinalized: (license: { name: string }) => void;
    }) => (
      <button
        type="button"
        data-has-base={baseLicense ? 'yes' : 'no'}
        onClick={() =>
          onFinalized({ name: 'Read it, do not copy it' })
        }
      >
        Finalize
      </button>
    ),
  }),
);

describe(LicenseAssistantPage.name, () => {
  beforeEach(() => {
    auth = { user: { roles: ['writer'] }, loading: false };
  });

  it('refuses a reader', () => {
    // Arrange
    auth = { user: { roles: ['reader'] }, loading: false };

    // Act
    render(<LicenseAssistantPage />);

    // Assert
    expect(screen.getByText(/Only writers can draft/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Finalize' }),
    ).not.toBeInTheDocument();
  });

  it('starts the assistant from nothing and says what was saved', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<LicenseAssistantPage />);

    // Act
    const button = screen.getByRole('button', { name: 'Finalize' });
    await user.click(button);

    // Assert
    expect(button).toHaveAttribute('data-has-base', 'no');
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Read it, do not copy it'),
    );
  });
});
