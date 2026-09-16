import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { showApiError } from '../../utils/notification';
import { ChapterCreatePage } from './ChapterCreatePage';
import { useNovelOutletContext } from './NovelLayout';

const createChapterMutate = vi.fn();

vi.mock('../../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../../generated/graphql')
  >('../../generated/graphql');

  return {
    ...actual,
    useCreateChapterMutation: () => ({
      mutate: createChapterMutate,
      isPending: false,
    }),
  };
});

vi.mock('./NovelLayout', () => ({
  useNovelOutletContext: vi.fn(),
}));

vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
}));

function renderCreatePage() {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/novel/:id/chapters/new',
        element: (
          <QueryClientProvider client={queryClient}>
            <ChapterCreatePage />
          </QueryClientProvider>
        ),
      },
      {
        path: '/novel/:id/chapters/:chapterId/edit',
        element: <div>Edit page</div>,
      },
    ],
    {
      initialEntries: [
        '/novel/93fec4bf-2f66-4e4a-9572-7aa4871f1458/chapters/new',
      ],
    },
  );

  return render(<RouterProvider router={router} />);
}

describe('ChapterCreatePage', () => {
  beforeEach(() => {
    createChapterMutate.mockReset();
    vi.mocked(showApiError).mockReset();
    vi.mocked(useNovelOutletContext).mockReturnValue({
      novel: {
        id: '93fec4bf-2f66-4e4a-9572-7aa4871f1458',
      } as never,
      canEditContent: true,
      canManageTts: false,
    });
  });

  it('renders a forbidden view instead of the form when the viewer cannot edit content', () => {
    // Arrange
    vi.mocked(useNovelOutletContext).mockReturnValue({
      novel: {
        id: '93fec4bf-2f66-4e4a-9572-7aa4871f1458',
      } as never,
      canEditContent: false,
      canManageTts: false,
    });

    // Act
    renderCreatePage();

    // Assert
    expect(
      screen.getByText(/don't have permission to create/i),
    ).toBeTruthy();
    expect(screen.queryByPlaceholderText('Chapter title')).toBeNull();
    expect(createChapterMutate).not.toHaveBeenCalled();
  });

  it('disables submit until both title and content are filled in', () => {
    // Arrange
    renderCreatePage();

    // Assert
    expect(
      screen.getByRole('button', { name: 'Create Chapter' }),
    ).toBeDisabled();

    // Act
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'Chapter 1' },
    });

    // Assert
    expect(
      screen.getByRole('button', { name: 'Create Chapter' }),
    ).toBeDisabled();

    // Act
    fireEvent.change(
      screen.getByPlaceholderText(
        'Chapter content in markdown format',
      ),
      { target: { value: '# Chapter 1\n\nSome content.' } },
    );

    // Assert
    expect(
      screen.getByRole('button', { name: 'Create Chapter' }),
    ).toBeEnabled();
  });

  it('submits the title and content, and navigates to the edit page on success', async () => {
    // Arrange
    createChapterMutate.mockImplementation((_variables, options) => {
      options.onSuccess({
        createChapter: { id: 'e0e19c33-2e56-4f5f-9b7c-9c17e7dbd230' },
      });
    });
    renderCreatePage();
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'Chapter 1: The Beginning' },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        'Chapter content in markdown format',
      ),
      {
        target: {
          value: '# Chapter 1\n\nIt was a dark and stormy night.',
        },
      },
    );

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Chapter' }),
    );

    // Assert
    expect(createChapterMutate).toHaveBeenCalledExactlyOnceWith(
      {
        novelId: '93fec4bf-2f66-4e4a-9572-7aa4871f1458',
        input: {
          title: 'Chapter 1: The Beginning',
          content: '# Chapter 1\n\nIt was a dark and stormy night.',
        },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(await screen.findByText('Edit page')).toBeTruthy();
  });

  it('shows an API error toast and stays on the page when the mutation fails', () => {
    // Arrange
    createChapterMutate.mockImplementation((_variables, options) => {
      options.onError(new Error('Network error'));
    });
    renderCreatePage();
    fireEvent.change(screen.getByPlaceholderText('Chapter title'), {
      target: { value: 'Chapter 1' },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        'Chapter content in markdown format',
      ),
      { target: { value: 'Some content.' } },
    );

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Chapter' }),
    );

    // Assert
    expect(showApiError).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: 'Create Chapter' }),
    ).toBeTruthy();
  });
});
