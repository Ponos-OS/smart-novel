import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { ComponentProps, useEffect, useState } from 'react';
import {
  createMemoryRouter,
  RouterProvider,
  useNavigate,
} from 'react-router-dom';

import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { ChapterContentEditor } from './ChapterContentEditor';

type EditorProps = ComponentProps<typeof ChapterContentEditor>;

/**
 * Renders `ChapterContentEditor` inside a data router (`useBlocker` requires one) with a
 * second `/other` route to land on after a confirmed navigation. `onCancel`/`onSaved`
 * default to navigating there, matching how the real edit page wires them, unless a test
 * supplies its own. `updateChapter` lets a test simulate a prop update (e.g. a refetch
 * resolving) without unmounting the component.
 */
function renderEditor(props: EditorProps) {
  const queryClient = new QueryClient();
  const external: {
    setChapter: (chapter: EditorProps['chapter']) => void;
  } = {
    setChapter: () => {
      throw new Error('EditorRoute has not rendered yet');
    },
  };

  function EditorRoute() {
    const [chapter, setChapter] = useState(props.chapter);
    useEffect(() => {
      external.setChapter = setChapter;
    }, [setChapter]);
    const navigate = useNavigate();

    return (
      <ChapterContentEditor
        {...props}
        chapter={chapter}
        onCancel={props.onCancel ?? (() => navigate('/other'))}
        onSaved={props.onSaved ?? (() => navigate('/other'))}
      />
    );
  }

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <QueryClientProvider client={queryClient}>
            <EditorRoute />
          </QueryClientProvider>
        ),
      },
      { path: '/other', element: <div>Other Page</div> },
    ],
    { initialEntries: ['/'] },
  );

  return {
    queryClient,
    updateChapter: (chapter: EditorProps['chapter']) =>
      act(() => external.setChapter(chapter)),
    ...render(<RouterProvider router={router} />),
  };
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

  it('clicking Edit navigates to the dedicated edit route instead of editing inline', () => {
    // Arrange
    const onEditClick = vi.fn();
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      onEditClick,
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    // Assert
    expect(onEditClick).toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Chapter title')).toBeNull();
  });

  it('changing only the title and saving calls only updateChapter', () => {
    // Arrange
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'New Title' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(updateChapterMutate).toHaveBeenCalledWith(
      {
        id: baseChapter.id,
        input: { title: 'New Title' },
        expectedUpdatedAt: baseChapter.updatedAt,
      },
      expect.any(Object),
    );
    expect(updateContentMutate).not.toHaveBeenCalled();
    expect(updateChapterAndContentMutate).not.toHaveBeenCalled();
  });

  it('changing only the content and saving calls only updateContent', () => {
    // Arrange
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });
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
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });
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
        expectedUpdatedAt: baseChapter.updatedAt,
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
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });
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

  it('shows a distinct conflict message and a Reload latest control instead of the generic error toast on a version conflict', () => {
    // Arrange
    updateChapterMutate.mockImplementation(
      (_variables, { onError }) =>
        onError(
          new GraphqlRequestError('Stale version', {
            code: 'CONFLICT',
            status: 409,
          }),
        ),
    );
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'New Title' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(screen.getByText(/updated by someone else/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Reload latest' }),
    ).toBeTruthy();
    expect(showApiError).not.toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('Reload latest triggers a refetch and stays in edit mode showing a reloading indicator, without calling any mutation', () => {
    // Arrange
    updateChapterMutate.mockImplementation(
      (_variables, { onError }) =>
        onError(
          new GraphqlRequestError('Stale version', {
            code: 'CONFLICT',
            status: 409,
          }),
        ),
    );
    const { queryClient } = renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });
    const invalidateQueries = vi.spyOn(
      queryClient,
      'invalidateQueries',
    );
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'New Title' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Reload latest' }),
    );

    // Assert
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        'GetChapter',
        {
          novelId: baseChapter.novelId,
          chapterId: baseChapter.id,
        },
      ],
    });
    expect(
      screen.getByText(/reloading the latest version/i),
    ).toBeTruthy();
    expect(screen.getByPlaceholderText('Chapter title')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Reload latest' }),
    ).toBeNull();
    expect(updateContentMutate).not.toHaveBeenCalled();
    expect(updateChapterAndContentMutate).not.toHaveBeenCalled();
  });

  it('syncs the editor to the fresh chapter and resumes editing once the refetch actually lands, without navigating away', () => {
    // Arrange
    updateChapterMutate.mockImplementation(
      (_variables, { onError }) =>
        onError(
          new GraphqlRequestError('Stale version', {
            code: 'CONFLICT',
            status: 409,
          }),
        ),
    );
    const { updateChapter } = renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'New Title' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Reload latest' }),
    );

    // Act: the refetch resolves with someone else's newer version
    updateChapter({
      ...baseChapter,
      title: 'Someone Else Title',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    // Assert
    expect(
      screen.queryByText(/reloading the latest version/i),
    ).toBeNull();
    expect(
      screen.getByDisplayValue('Someone Else Title'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('cancel navigates away immediately when there are no unsaved changes', () => {
    // Arrange
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.getByText('Other Page')).toBeTruthy();
    expect(updateContentMutate).not.toHaveBeenCalled();
    expect(updateChapterMutate).not.toHaveBeenCalled();
    expect(updateChapterAndContentMutate).not.toHaveBeenCalled();
  });

  it('cancelling with unsaved changes shows a confirmation prompt; Keep Editing stays, Discard Changes navigates away', () => {
    // Arrange
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'New Title' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert: still on the editor, showing the confirmation
    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy();
    expect(screen.getByDisplayValue('New Title')).toBeTruthy();

    // Act: keep editing
    fireEvent.click(
      screen.getByRole('button', { name: 'Keep Editing' }),
    );

    // Assert: unsaved edits are preserved, no navigation happened
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
    expect(screen.getByDisplayValue('New Title')).toBeTruthy();

    // Act: cancel again and confirm the discard
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Discard Changes' }),
    );

    // Assert
    expect(screen.getByText('Other Page')).toBeTruthy();
    expect(updateContentMutate).not.toHaveBeenCalled();
    expect(updateChapterMutate).not.toHaveBeenCalled();
    expect(updateChapterAndContentMutate).not.toHaveBeenCalled();
  });

  it('a successful save navigates via onSaved without triggering the unsaved-changes confirmation', () => {
    // Arrange
    updateChapterMutate.mockImplementation(
      (_variables, { onSuccess }) => onSuccess(),
    );
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'New Title' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(screen.getByText('Other Page')).toBeTruthy();
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
  });

  it('preview renders the unsaved content as markdown without calling any mutation', () => {
    // Arrange
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });
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
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });

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
    renderEditor({
      chapter: baseChapter,
      canEdit: true,
      startInEditMode: true,
    });

    // Assert
    expect(
      screen
        .getByRole('button', { name: 'Save' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });
});
