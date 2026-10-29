import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { Dialog } from './Dialog';

function Page({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Dialog
          title="CC BY 4.0"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <a href="#official">Official text</a>
        </Dialog>
      )}
    </>
  );
}

describe(Dialog.name, () => {
  it('is a modal dialog named by its title, and starts on the Close button', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Page />);

    // Act
    await user.click(screen.getByRole('button', { name: 'Open' }));

    // Assert
    expect(
      screen.getByRole('dialog', { name: 'CC BY 4.0' }),
    ).toHaveAttribute('aria-modal', 'true');
    expect(
      screen.getByRole('button', { name: 'Close' }),
    ).toHaveFocus();
  });

  it.each([
    [
      'Escape',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.keyboard('{Escape}'),
    ],
    [
      'the Close button',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Close' })),
    ],
  ])(
    'closes with %s and gives focus back to what opened it',
    async (_, close) => {
      // Arrange
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Page onClose={onClose} />);
      await user.click(screen.getByRole('button', { name: 'Open' }));

      // Act
      await close(user);

      // Assert
      expect(onClose).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Open' }),
      ).toHaveFocus();
    },
  );

  it('closes on a click outside the dialog, not on one inside', async () => {
    // Arrange
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    // Act
    fireEvent.mouseDown(screen.getByRole('dialog'));
    const insideCalls = onClose.mock.calls.length;
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);

    // Assert
    expect(insideCalls).toBe(0);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const close = screen.getByRole('button', { name: 'Close' });
    const link = screen.getByRole('link', { name: 'Official text' });

    // Act
    await user.tab();
    const afterTab = document.activeElement;
    await user.tab();
    const wrapped = document.activeElement;
    await user.tab({ shift: true });
    const wrappedBack = document.activeElement;

    // Assert
    expect(afterTab).toBe(link);
    expect(wrapped).toBe(close);
    expect(wrappedBack).toBe(link);
  });
});
