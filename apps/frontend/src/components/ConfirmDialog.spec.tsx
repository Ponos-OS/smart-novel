import { fireEvent, render, screen } from '@testing-library/react';

import { ConfirmDialog } from './ConfirmDialog';

function renderDialog(
  props: Partial<Parameters<typeof ConfirmDialog>[0]> = {},
) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  render(
    <ConfirmDialog
      title="Delete chapter"
      message="Delete this chapter?"
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );

  return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('calls onConfirm when the confirm button is clicked', () => {
    // Arrange
    const { onConfirm, onCancel } = renderDialog();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // Assert
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', () => {
    // Arrange
    const { onConfirm, onCancel } = renderDialog();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables both buttons while loading', () => {
    // Arrange
    renderDialog({ isLoading: true });

    // Assert
    expect(
      screen.getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Deleting...' }),
    ).toBeDisabled();
  });

  describe('with a confirmation text', () => {
    it('keeps the confirm button disabled until the exact text is typed', () => {
      // Arrange
      const { onConfirm } = renderDialog({
        confirmationText: 'The Lantern Keeper',
      });
      const input = screen.getByRole('textbox');

      // Assert
      expect(
        screen.getByRole('button', { name: 'Delete' }),
      ).toBeDisabled();

      // Act
      fireEvent.change(input, {
        target: { value: 'the lantern keeper' },
      });

      // Assert
      expect(
        screen.getByRole('button', { name: 'Delete' }),
      ).toBeDisabled();

      // Act
      fireEvent.change(input, {
        target: { value: 'The Lantern Keeper ' },
      });

      // Assert
      expect(
        screen.getByRole('button', { name: 'Delete' }),
      ).toBeDisabled();

      // Act
      fireEvent.change(input, {
        target: { value: 'The Lantern Keeper' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      // Assert
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('shows no text field when no confirmation text is given', () => {
      // Arrange
      renderDialog();

      // Assert
      expect(screen.queryByRole('textbox')).toBeNull();
    });
  });

  it('shows the error', () => {
    // Arrange
    renderDialog({ error: 'Chapter with id 4bbc4da9 not found' });

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Chapter with id 4bbc4da9 not found',
    );
  });
});
