import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { useCanCreateNovel } from '../../hooks/useCanCreateNovel';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { HomePage } from './HomePage';

const endOfFirstPage = 'eyJhIjoibm92ZWxzIn0.c2lnbmF0dXJl';
const novel = {
  id: 'c1d31ec2-f478-4648-b90b-d1e53de2a829',
  name: 'The Journey Begins',
  writer: { penName: 'Jane_Doe' },
  description: 'A young hero leaves home.',
  state: 'ONGOING',
  tags: ['fantasy'],
  coverUrl: null,
};
const novelsQuery = vi.hoisted(() => vi.fn());

vi.mock('../../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../../generated/graphql')
  >('../../generated/graphql');

  return { ...actual, useGetNovelsQuery: novelsQuery };
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
  beforeEach(() => {
    novelsQuery.mockReturnValue({
      data: {
        novelsConnection: {
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      },
      isLoading: false,
      error: null,
    });
  });

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

  it('lists the novels under the heading, each linking to its page', () => {
    // Arrange
    vi.mocked(useCanCreateNovel).mockReturnValue({
      canCreate: false,
      loading: false,
    });
    novelsQuery.mockReturnValue({
      data: {
        novelsConnection: {
          edges: [{ cursor: endOfFirstPage, node: novel }],
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        },
      },
      isLoading: false,
      error: null,
    });

    // Act
    renderPage();

    // Assert
    expect(
      screen.getByRole('heading', { name: 'Discover Novels' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /The Journey Begins/ }),
    ).toHaveAttribute('href', `/novel/${novel.id}`);
  });

  it('says so when there is no novel', () => {
    // Arrange
    vi.mocked(useCanCreateNovel).mockReturnValue({
      canCreate: false,
      loading: false,
    });

    // Act
    renderPage();

    // Assert
    expect(screen.getByText('No novels found.')).toBeTruthy();
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

  it('should go back to the first page when the cursor of the next one is refused', async () => {
    // Arrange
    vi.mocked(useCanCreateNovel).mockReturnValue({
      canCreate: false,
      loading: false,
    });
    novelsQuery.mockImplementation(
      ({ after }: { after: string | null }) =>
        after
          ? {
              data: undefined,
              isLoading: false,
              error: new GraphqlRequestError('Invalid cursor'),
            }
          : {
              data: {
                novelsConnection: {
                  edges: [{ cursor: endOfFirstPage, node: novel }],
                  pageInfo: {
                    hasNextPage: true,
                    hasPreviousPage: false,
                    endCursor: endOfFirstPage,
                  },
                },
              },
              isLoading: false,
              error: null,
            },
    );
    renderPage();

    // Act
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Assert
    expect(
      (await screen.findAllByText('The Journey Begins')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Failed to fetch novels')).toBeNull();
    expect(novelsQuery).toHaveBeenLastCalledWith(
      { first: 20, after: null },
      expect.anything(),
    );
  });
});
