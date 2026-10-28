import { fireEvent, render, screen } from '@testing-library/react';

import { NovelState } from '../../generated/graphql';
import { NovelForm } from './NovelForm';

function renderForm(
  props: Partial<Parameters<typeof NovelForm>[0]> = {},
) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  render(
    <NovelForm
      submitLabel="Create novel"
      isSubmitting={false}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />,
  );

  return { onSubmit, onCancel };
}

describe('NovelForm', () => {
  it('disables submit until both name and author are filled in', () => {
    // Arrange
    renderForm();

    // Assert
    expect(
      screen.getByRole('button', { name: 'Create novel' }),
    ).toBeDisabled();

    // Act
    fireEvent.change(screen.getByPlaceholderText('Novel name'), {
      target: { value: 'The Lantern Keeper' },
    });

    // Assert
    expect(
      screen.getByRole('button', { name: 'Create novel' }),
    ).toBeDisabled();

    // Act
    fireEvent.change(screen.getByPlaceholderText('Author'), {
      target: { value: '   ' },
    });

    // Assert
    expect(
      screen.getByRole('button', { name: 'Create novel' }),
    ).toBeDisabled();

    // Act
    fireEvent.change(screen.getByPlaceholderText('Author'), {
      target: { value: 'Jane Doe' },
    });

    // Assert
    expect(
      screen.getByRole('button', { name: 'Create novel' }),
    ).toBeEnabled();
  });

  it('submits trimmed values with the categories as a list', () => {
    // Arrange
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByPlaceholderText('Novel name'), {
      target: { value: '  The Lantern Keeper ' },
    });
    fireEvent.change(screen.getByPlaceholderText('Author'), {
      target: { value: ' Jane Doe ' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('A short description'),
      {
        target: {
          value: ' A lighthouse keeper finds a door in the fog. ',
        },
      },
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: NovelState.Finished },
    });
    fireEvent.change(
      screen.getByPlaceholderText('fantasy, adventure'),
      {
        target: { value: ' fantasy, ,adventure ,' },
      },
    );

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Create novel' }),
    );

    // Assert
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      name: 'The Lantern Keeper',
      author: 'Jane Doe',
      description: 'A lighthouse keeper finds a door in the fog.',
      state: NovelState.Finished,
      categories: ['fantasy', 'adventure'],
    });
  });

  it('starts from the initial values', () => {
    // Arrange
    renderForm({
      initialValues: {
        name: 'The Lantern Keeper',
        author: 'Jane Doe',
        description: 'A lighthouse keeper finds a door in the fog.',
        state: NovelState.Finished,
        categories: ['fantasy', 'adventure'],
      },
      submitLabel: 'Save',
    });

    // Assert
    expect(screen.getByPlaceholderText('Novel name')).toHaveValue(
      'The Lantern Keeper',
    );
    expect(screen.getByRole('combobox')).toHaveValue(
      NovelState.Finished,
    );
    expect(
      screen.getByPlaceholderText('fantasy, adventure'),
    ).toHaveValue('fantasy, adventure');
    expect(
      screen.getByRole('button', { name: 'Save' }),
    ).toBeEnabled();
  });

  it('disables the fields and the buttons while submitting', () => {
    // Arrange
    renderForm({
      isSubmitting: true,
      initialValues: {
        name: 'The Lantern Keeper',
        author: 'Jane Doe',
        description: '',
        state: NovelState.Ongoing,
        categories: [],
      },
    });

    // Assert
    expect(screen.getByPlaceholderText('Novel name')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Cancel' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Create novel' }),
    ).toBeDisabled();
  });

  it('calls onCancel without submitting', () => {
    // Arrange
    const { onSubmit, onCancel } = renderForm();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
