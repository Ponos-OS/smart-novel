import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { useCanCreateNovel } from '../../hooks/useCanCreateNovel';
import { HomePage } from './HomePage';

vi.mock('../../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../../generated/graphql')
  >('../../generated/graphql');

  return {
    ...actual,
    useGetNovelsQuery: () => ({
      data: {
        novelsConnection: {
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      },
      isLoading: false,
      error: null,
    }),
  };
});

vi.mock('../../hooks/useCanCreateNovel', () => ({
  useCanCreateNovel: vi.fn(),
}));

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <HomePage /> },
      { path: '/novels/new', element: <div>New novel page</div> },
    ],
    { initialEntries: ['/'] },
  );

  return render(<RouterProvider router={router} />);
}

describe('HomePage', () => {
  it('offers a way to create a novel to those who can, and opens the form', async () => {
    // Arrange
    vi.mocked(useCanCreateNovel).mockReturnValue({
      canCreate: true,
      loading: false,
    });
    renderPage();

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'New novel' }),
    );

    // Assert
    expect(await screen.findByText('New novel page')).toBeTruthy();
  });

  it('hides the entry for those who cannot create a novel', () => {
    // Arrange
    vi.mocked(useCanCreateNovel).mockReturnValue({
      canCreate: false,
      loading: false,
    });

    // Act
    renderPage();

    // Assert
    expect(
      screen.queryByRole('button', { name: 'New novel' }),
    ).toBeNull();
  });
});
