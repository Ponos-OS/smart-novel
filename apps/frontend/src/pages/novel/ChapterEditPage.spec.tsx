import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ChapterEditPage } from './ChapterEditPage';
import { useNovelOutletContext } from './NovelLayout';

const updateContentMutate = vi.fn();
const updateChapterMutate = vi.fn();
const updateChapterAndContentMutate = vi.fn();

vi.mock('../../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../../generated/graphql')
  >('../../generated/graphql');

  return {
    ...actual,
    useGetChapterQuery: () => ({
      data: {
        novel: {
          chapter: {
            id: 'e0e19c33-2e56-4f5f-9b7c-9c17e7dbd230',
            novelId: '93fec4bf-2f66-4e4a-9572-7aa4871f1458',
            title: 'A Chapter',
            content: 'Chapter body text.',
            updatedAt: '2026-01-01T00:00:00.000Z',
            contentUpdatedAt: '2026-01-01T00:00:00.000Z',
            narrationStatus: null,
            narrationUrl: null,
          },
        },
      },
      isLoading: false,
    }),
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

vi.mock('./NovelLayout', () => ({
  useNovelOutletContext: vi.fn(),
}));

function renderEditPage() {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          '/novel/93fec4bf-2f66-4e4a-9572-7aa4871f1458/chapters/e0e19c33-2e56-4f5f-9b7c-9c17e7dbd230/edit',
        ]}
      >
        <Routes>
          <Route
            path="/novel/:id/chapters/:chapterId/edit"
            element={<ChapterEditPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ChapterEditPage', () => {
  beforeEach(() => {
    updateContentMutate.mockReset();
    updateChapterMutate.mockReset();
    updateChapterAndContentMutate.mockReset();
  });

  it('renders a forbidden view instead of the editor when the viewer cannot edit content', () => {
    // Arrange
    vi.mocked(useNovelOutletContext).mockReturnValue({
      novel: {
        id: '93fec4bf-2f66-4e4a-9572-7aa4871f1458',
      } as never,
      canEditContent: false,
      canManageTts: false,
    });

    // Act
    renderEditPage();

    // Assert
    expect(
      screen.getByText(/don't have permission to edit/i),
    ).toBeTruthy();
    expect(screen.queryByPlaceholderText('Chapter title')).toBeNull();
    expect(updateContentMutate).not.toHaveBeenCalled();
    expect(updateChapterMutate).not.toHaveBeenCalled();
    expect(updateChapterAndContentMutate).not.toHaveBeenCalled();
  });

  it('renders the editor immediately, already in edit mode, when the viewer can edit content', () => {
    // Arrange
    vi.mocked(useNovelOutletContext).mockReturnValue({
      novel: {
        id: '93fec4bf-2f66-4e4a-9572-7aa4871f1458',
      } as never,
      canEditContent: true,
      canManageTts: false,
    });

    // Act
    renderEditPage();

    // Assert
    expect(screen.getByPlaceholderText('Chapter title')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
});
