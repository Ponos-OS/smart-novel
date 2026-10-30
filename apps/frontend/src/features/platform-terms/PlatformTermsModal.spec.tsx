import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { PlatformTermsModal } from './PlatformTermsModal';

const markdown =
  '# Platform terms\n\nYou grant the platform a license to host and display your work.';

function renderModal(
  props: Partial<
    React.ComponentProps<typeof PlatformTermsModal>
  > = {},
) {
  const onAccept = vi.fn();
  const onLogout = vi.fn();

  render(
    <MemoryRouter>
      <PlatformTermsModal
        markdown={markdown}
        onAccept={onAccept}
        onLogout={onLogout}
        {...props}
      />
    </MemoryRouter>,
  );

  return { onAccept, onLogout };
}

describe(PlatformTermsModal.name, () => {
  it('renders the terms inside a modal dialog', () => {
    // Act
    renderModal();

    // Assert
    expect(
      screen.getByRole('dialog', { name: 'Platform terms' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    expect(
      screen.getByText(/license to host and display/),
    ).toBeInTheDocument();
  });

  it('keeps Accept disabled until the agreement is checked', async () => {
    // Arrange
    const { onAccept } = renderModal();
    const user = userEvent.setup();

    // Act
    const isDisabledBefore = screen
      .getByRole('button', { name: 'Accept' })
      .hasAttribute('disabled');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Accept' }));

    // Assert
    expect(isDisabledBefore).toBeTrue();
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('offers Log out as the only alternative', async () => {
    // Arrange
    const { onLogout, onAccept } = renderModal();
    const user = userEvent.setup();

    // Act
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    // Assert
    expect(onLogout).toHaveBeenCalledOnce();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('is not dismissed by Escape or a backdrop click', async () => {
    // Arrange
    const { onAccept, onLogout } = renderModal();
    const user = userEvent.setup();

    // Act
    await user.keyboard('{Escape}');
    // The page behind a modal dialog is unclickable, so press on it directly.
    await new Promise((resolve) => setTimeout(resolve, 10));
    fireEvent.pointerDown(document.body);

    // Assert
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onAccept).not.toHaveBeenCalled();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('links to the licenses and terms page', () => {
    // Act
    renderModal();

    // Assert
    expect(
      screen.getByRole('link', {
        name: 'Read the licenses and terms',
      }),
    ).toHaveAttribute('href', '/licenses');
  });

  it('moves the initial focus into the dialog', () => {
    // Act
    renderModal();

    // Assert
    expect(screen.getByRole('checkbox')).toHaveFocus();
  });

  it('wraps Tab from the last control to the first and Shift+Tab back', async () => {
    // Arrange
    renderModal();
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox'));
    const licensesLink = screen.getByRole('link', {
      name: 'Read the licenses and terms',
    });
    const accept = screen.getByRole('button', { name: 'Accept' });

    // Act
    accept.focus();
    await user.tab();
    const afterTab = document.activeElement;
    await user.tab({ shift: true });

    // Assert
    expect(afterTab).toBe(licensesLink);
    expect(accept).toHaveFocus();
  });

  it('shows the error and disables the controls while accepting', () => {
    // Act
    renderModal({
      isAccepting: true,
      error: 'Network request failed',
    });

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Network request failed',
    );
    expect(
      screen.getByRole('button', { name: 'Accepting...' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Log out' }),
    ).toBeDisabled();
  });
});
