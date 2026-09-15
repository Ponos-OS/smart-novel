import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { ComponentProps } from 'react';

import { showApiError, showSuccess } from '../../utils/notification';
import { ChapterContentEditor } from './ChapterContentEditor';

function renderEditor(
  props: ComponentProps<typeof ChapterContentEditor>,
) {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <ChapterContentEditor {...props} />
    </QueryClientProvider>,
  );
}

const updateContentMutate = vi.fn();
const updateChapterMutate = vi.fn();
const updateChapterAndContentMutate = vi.fn();

vi.mock('../../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../../generated/graphql')
  >('../../generated/graphql');

  const useGetChapterQuery = Object.assign(() => undefined, {
    getKey: (variables: { novelId: string; chapterId: string }) => [
      'GetChapter',
      variables,
    ],
  });

  return {
    ...actual,
    useGetChapterQuery,
    useUpdateContentMutation: () => ({
      mutate: updateContentMutate,
      isPending: false,
    }),
    useUpdateChapterMutation: () => ({
      mutate: updateChapterMutate,
      isPending: false,
    }),
    useUpdateChapterAndContentMutation: () => ({
      mutate: updateChapterAndContentMutate,
      isPending: false,
    }),
  };
});

vi.mock('../../components/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
  showSuccess: vi.fn(),
}));

const baseChapter = {
  id: '4dd92f16-4743-47b9-960c-6529678e9bc5',
  novelId: 'c1d31ec2-f478-4648-b90b-d1e53de2a829',
  title: 'A Chapter',
  content: 'Chapter body text.',
  updatedAt: '2026-01-01T00:00:00.000Z',
  contentUpdatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ChapterContentEditor', () => {
  beforeEach(() => {
    updateContentMutate.mockReset();
    updateChapterMutate.mockReset();
    updateChapterAndContentMutate.mockReset();
    vi.mocked(showApiError).mockReset();
    vi.mocked(showSuccess).mockReset();
  });

  it('hides the edit control when canEdit is false', () => {
    // Arrange
    renderEditor({ chapter: baseChapter, canEdit: false });

    // Act
    const editButton = screen.queryByRole('button', { name: 'Edit' });

    // Assert
    expect(editButton).toBeNull();
  });

  it('renders the read-only title and content when idle', () => {
    // Arrange
    renderEditor({ chapter: baseChapter, canEdit: true });

    // Act & Assert
    expect(screen.getByText('A Chapter')).toBeTruthy();
    expect(screen.getByTestId('markdown').textContent).toBe(
      'Chapter body text.',
    );
  });

  it('changing only the title and saving calls only updateChapter', () => {
    // Arrange
    renderEditor({ chapter: baseChapter, canEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'New Title' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(updateChapterMutate).toHaveBeenCalledWith(
      { id: baseChapter.id, input: { title: 'New Title' } },
      expect.any(Object),
    );
    expect(updateContentMutate).not.toHaveBeenCalled();
    expect(updateChapterAndContentMutate).not.toHaveBeenCalled();
  });

  it('changing only the content and saving calls only updateContent', () => {
    // Arrange
    renderEditor({ chapter: baseChapter, canEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue('Chapter body text.'), {
      target: { value: 'New body.' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(updateContentMutate).toHaveBeenCalledWith(
      {
        id: baseChapter.id,
        content: 'New body.',
        expectedContentUpdatedAt: baseChapter.contentUpdatedAt,
      },
      expect.any(Object),
    );
    expect(updateChapterMutate).not.toHaveBeenCalled();
    expect(updateChapterAndContentMutate).not.toHaveBeenCalled();
  });

  it('changing both title and content and saving fires only the combined mutation', () => {
    // Arrange
    renderEditor({ chapter: baseChapter, canEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'New Title' },
    });
    fireEvent.change(screen.getByDisplayValue('Chapter body text.'), {
      target: { value: 'New body.' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(updateChapterAndContentMutate).toHaveBeenCalledWith(
      {
        id: baseChapter.id,
        content: 'New body.',
        expectedContentUpdatedAt: baseChapter.contentUpdatedAt,
        input: { title: 'New Title' },
      },
      expect.any(Object),
    );
    expect(updateContentMutate).not.toHaveBeenCalled();
    expect(updateChapterMutate).not.toHaveBeenCalled();
  });

  it('shows an error toast and keeps the unsaved title/content when the save mutation fails', () => {
    // Arrange
    updateChapterMutate.mockImplementation(
      (_variables, { onError }) => onError(),
    );
    renderEditor({ chapter: baseChapter, canEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'New Title' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(showApiError).toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('New Title')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('cancel discards both changes and returns to read-only view without calling any mutation', () => {
    // Arrange
    renderEditor({ chapter: baseChapter, canEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'New Title' },
    });
    fireEvent.change(screen.getByDisplayValue('Chapter body text.'), {
      target: { value: 'New body.' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(updateContentMutate).not.toHaveBeenCalled();
    expect(updateChapterMutate).not.toHaveBeenCalled();
    expect(updateChapterAndContentMutate).not.toHaveBeenCalled();
    expect(screen.getByText('A Chapter')).toBeTruthy();
    expect(screen.getByTestId('markdown').textContent).toBe(
      'Chapter body text.',
    );
  });

  it('preview renders the unsaved content as markdown without calling any mutation', () => {
    // Arrange
    renderEditor({ chapter: baseChapter, canEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue('Chapter body text.'), {
      target: { value: 'Unsaved draft.' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    // Assert
    expect(screen.getByTestId('markdown').textContent).toBe(
      'Unsaved draft.',
    );
    expect(updateContentMutate).not.toHaveBeenCalled();
    expect(updateChapterMutate).not.toHaveBeenCalled();
    expect(updateChapterAndContentMutate).not.toHaveBeenCalled();
  });

  it('disables Save when the title is empty', () => {
    // Arrange
    renderEditor({ chapter: baseChapter, canEdit: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    // Act
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: '' },
    });

    // Assert
    expect(
      screen
        .getByRole('button', { name: 'Save' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('disables Save when neither title nor content has changed', () => {
    // Arrange
    renderEditor({ chapter: baseChapter, canEdit: true });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    // Assert
    expect(
      screen
        .getByRole('button', { name: 'Save' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });
});
