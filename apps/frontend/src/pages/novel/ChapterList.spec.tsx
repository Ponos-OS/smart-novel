import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { ChapterList } from './ChapterList';

vi.mock('../../hooks/useReadChapters', () => ({
  useReadChapters: () => ({ isRead: () => false }),
}));

vi.mock('../../components/GenerateTtsButton', () => ({
  GenerateTtsButton: () => null,
}));

const chapters = [
  {
    id: '4dd92f16-4743-47b9-960c-6529678e9bc5',
    title: 'The Beginning',
    createdAt: '2026-10-28T16:40:19.684Z',
  },
  {
    id: '4769a024-6267-4abc-a412-5ab0241a8d0e',
    title: 'The First Challenge',
    createdAt: '2026-10-28T16:40:19.684Z',
  },
];

function renderList(
  props: Partial<Parameters<typeof ChapterList>[0]> = {},
) {
  const onDelete = vi.fn().mockResolvedValue(undefined);

  render(
    <ChapterList
      chapters={chapters}
      onChapterClick={vi.fn()}
      onEditClick={vi.fn()}
      onDelete={onDelete}
      currentChapterId={null}
      canEditContent
      {...props}
    />,
  );

  return { onDelete };
}

describe('ChapterList delete', () => {
  it.each([
    {
      name: 'the viewer cannot edit content',
      props: { canEditContent: false },
    },
    {
      name: 'no delete handler is given',
      props: { onDelete: undefined },
    },
  ])('hides the delete button when $name', ({ props }) => {
    // Arrange
    renderList(props);

    // Assert
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).toBeNull();
  });

  it('changes nothing when the dialog is cancelled', () => {
    // Arrange
    const { onDelete } = renderList();

    // Act
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete' })[0],
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('deletes the chosen chapter on confirm and closes the dialog', async () => {
    // Arrange
    const { onDelete } = renderList();

    // Act
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete' })[1],
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );

    // Assert
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).toBeNull(),
    );
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(
      '4769a024-6267-4abc-a412-5ab0241a8d0e',
    );
  });

  it('shows the error in the open dialog when the delete fails', async () => {
    // Arrange
    const onDelete = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'You do not have permission to delete this chapter',
        ),
      );
    renderList({ onDelete });

    // Act
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete' })[0],
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to delete this chapter',
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
