import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { LicenseSourceType } from '../../generated/graphql';
import { ChapterListPage } from './ChapterListPage';
import { useNovelOutletContext } from './NovelLayout';

const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';

vi.mock('./NovelLayout', () => ({
  useNovelOutletContext: vi.fn(),
}));

vi.mock('./ChapterList', () => ({
  ChapterList: () => null,
}));

function renderPage(
  canEditContent: boolean,
  novelOverrides: Record<string, unknown> = {},
) {
  vi.mocked(useNovelOutletContext).mockReturnValue({
    novel: {
      id: novelId,
      name: 'The Lantern Keeper',
      writer: { penName: 'Jane_Doe' },
      description: 'A lighthouse keeper finds a door in the fog.',
      tags: [],
      license: {
        id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
        name: 'CC BY 4.0',
        sourceType: LicenseSourceType.Canonical,
        canonicalId: 'CC-BY-4.0',
        text: 'Attribution 4.0 International',
      },
      chaptersConnection: { edges: [], totalCount: 0 },
      ...novelOverrides,
    } as never,
    canEditContent,
    canManageTts: false,
  });
  const router = createMemoryRouter(
    [
      {
        path: `/novel/${novelId}`,
        element: (
          <QueryClientProvider client={new QueryClient()}>
            <ChapterListPage />
          </QueryClientProvider>
        ),
      },
      {
        path: '/novel/:novelId/chapters/:chapterId',
        element: <div>Chapter page</div>,
      },
      {
        path: '/novels/:novelId/edit',
        element: <div>Edit novel page</div>,
      },
    ],
    { initialEntries: [`/novel/${novelId}`] },
  );

  return render(<RouterProvider router={router} />);
}

describe('ChapterListPage novel edit entry', () => {
  it('shows the pen name of the writer, not a real name', () => {
    renderPage(false);

    expect(screen.getByText('By Jane_Doe')).toBeInTheDocument();
  });

  it('opens the edit form for those who can edit the novel', async () => {
    // Arrange
    renderPage(true);

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit novel' }),
    );

    // Assert
    expect(await screen.findByText('Edit novel page')).toBeTruthy();
  });

  it('hides the entry for those who cannot edit the novel', () => {
    // Act
    renderPage(false);

    // Assert
    expect(
      screen.queryByRole('button', { name: 'Edit novel' }),
    ).toBeNull();
  });
});

describe('ChapterListPage read buttons', () => {
  const firstChapterId = '4dd92f16-4743-47b9-960c-6529678e9bc5';
  const latestChapterId = '4769a024-6267-4abc-a412-5ab0241a8d0e';
  const withChapters = {
    firstChapter: { id: firstChapterId },
    lastPublishedChapter: { id: latestChapterId },
    chaptersConnection: {
      edges: [
        {
          node: {
            id: firstChapterId,
            title: 'The Beginning',
            createdAt: '2026-10-28T16:40:19.684Z',
          },
        },
      ],
      totalCount: 1,
    },
  };

  it.each(['Read First Chapter', 'Read Latest Chapter'])(
    'opens a chapter with "%s"',
    async (name) => {
      renderPage(false, withChapters);

      fireEvent.click(screen.getByRole('button', { name }));

      expect(await screen.findByText('Chapter page')).toBeTruthy();
    },
  );

  it('shows the chapter count and disables both buttons while there is no chapter', () => {
    renderPage(false);

    expect(
      screen.getByRole('heading', { name: 'Chapters (0)' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Read First Chapter' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Read Latest Chapter' }),
    ).toBeDisabled();
  });
});
