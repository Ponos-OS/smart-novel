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

function renderPage(canEditContent: boolean) {
  vi.mocked(useNovelOutletContext).mockReturnValue({
    novel: {
      id: novelId,
      name: 'The Lantern Keeper',
      author: 'Jane Doe',
      description: 'A lighthouse keeper finds a door in the fog.',
      category: [],
      license: {
        id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
        name: 'CC BY 4.0',
        sourceType: LicenseSourceType.Canonical,
        canonicalId: 'CC-BY-4.0',
        text: 'Attribution 4.0 International',
      },
      chaptersConnection: { edges: [], totalCount: 0 },
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
        path: '/novels/:novelId/edit',
        element: <div>Edit novel page</div>,
      },
    ],
    { initialEntries: [`/novel/${novelId}`] },
  );

  return render(<RouterProvider router={router} />);
}

describe('ChapterListPage novel edit entry', () => {
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
