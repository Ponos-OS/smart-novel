import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { showApiError } from '../../utils/notification';
import { SearchPage } from './SearchPage';
import { useFilterCategories } from './use-filter-categories';

const search = vi.hoisted(() => ({ useSearchNovelsQuery: vi.fn() }));

vi.mock('../../hooks/useDebouncedValue', () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));
vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
}));
vi.mock('./use-filter-categories', () => ({
  useFilterCategories: vi.fn(),
}));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useSearchNovelsQuery: search.useSearchNovelsQuery,
}));

function mockCategories(
  overrides: Partial<ReturnType<typeof useFilterCategories>> = {},
) {
  const loadMore = vi.fn();

  vi.mocked(useFilterCategories).mockReturnValue({
    categories: [
      {
        id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
        name: 'fantasy',
        approximateNovelCount: 1203,
      },
      {
        id: '8e9a1b6d-3f47-4c20-b5a8-7d6c2e1f0a93',
        name: 'mystery',
        approximateNovelCount: 87,
      },
    ],
    isLoading: false,
    isError: false,
    isFetching: false,
    hasMore: false,
    isLoadingMore: false,
    loadMore,
    ...overrides,
  });

  return { loadMore };
}

function renderPage(url = '/search') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <SearchPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return userEvent.setup();
}

describe('SearchPage', () => {
  beforeEach(() => {
    mockCategories();
    vi.mocked(showApiError).mockReset();
    search.useSearchNovelsQuery.mockReset();
    search.useSearchNovelsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
  });

  it('shows the categories capitalized, with their estimated counts', () => {
    renderPage();

    const include = within(
      screen.getByRole('heading', { name: 'Include Categories' })
        .parentElement!,
    );
    expect(
      include.getByRole('button', { name: /Fantasy/ }),
    ).toHaveTextContent('~1.2K');
    expect(
      include.getByRole('button', { name: /Mystery/ }),
    ).toHaveTextContent('~87');
  });

  it('shows a loading and an error state for the categories', () => {
    mockCategories({ categories: [], isLoading: true });
    renderPage();
    expect(screen.getByText('Loading categories...')).toBeVisible();
  });

  it('notifies when the categories could not be loaded, once', () => {
    mockCategories({ categories: [], isError: true });

    renderPage();

    expect(showApiError).toHaveBeenCalledExactlyOnceWith(
      'The categories could not be loaded. Try again later.',
    );
  });

  it('does not notify when the categories were loaded', () => {
    renderPage();

    expect(showApiError).not.toHaveBeenCalled();
  });

  it('loads more categories on demand', async () => {
    const { loadMore } = mockCategories({ hasMore: true });
    const user = renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Show more categories' }),
    );

    expect(loadMore).toHaveBeenCalledOnce();
  });

  it('searches with the included and the excluded categories', async () => {
    const user = renderPage();
    await user.click(
      within(
        screen.getByRole('heading', { name: 'Include Categories' })
          .parentElement!,
      ).getByRole('button', { name: /Fantasy/ }),
    );
    await user.click(
      within(
        screen.getByRole('heading', { name: 'Exclude Categories' })
          .parentElement!,
      ).getByRole('button', { name: /Mystery/ }),
    );

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(search.useSearchNovelsQuery).toHaveBeenLastCalledWith(
      {
        filters: { category: { in: ['Fantasy'], nin: ['Mystery'] } },
      },
      { enabled: true },
    );
  });

  it('does not search before the button is pressed', () => {
    renderPage();

    expect(search.useSearchNovelsQuery).toHaveBeenLastCalledWith(
      { filters: undefined },
      { enabled: false },
    );
  });

  describe('searching the categories', () => {
    it('asks for all of them first, then for the ones matching what is typed', async () => {
      const user = renderPage();
      expect(useFilterCategories).toHaveBeenLastCalledWith('');

      await user.type(
        screen.getByLabelText('Search categories'),
        '  sci ',
      );

      expect(useFilterCategories).toHaveBeenLastCalledWith('sci');
    });

    it('says it is searching while the next list loads', () => {
      mockCategories({ isFetching: true });

      renderPage();

      expect(screen.getByRole('status')).toHaveTextContent(
        'Searching',
      );
    });

    it('keeps a picked category visible when a later search does not list it', async () => {
      const user = renderPage();
      await user.click(
        within(
          screen.getByRole('heading', { name: 'Include Categories' })
            .parentElement!,
        ).getByRole('button', { name: /Fantasy/ }),
      );
      mockCategories({
        categories: [
          {
            id: '3c1d9a52-7e08-4f6b-b2a4-91d05c7e6f13',
            name: 'sci-fi',
            approximateNovelCount: 54,
          },
        ],
      });

      await user.type(
        screen.getByLabelText('Search categories'),
        'sci',
      );

      const include = within(
        screen.getByRole('heading', { name: 'Include Categories' })
          .parentElement!,
      );
      expect(
        include.getByRole('button', { name: 'Fantasy' }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(
        include.getByRole('button', { name: /Sci-fi/ }),
      ).toHaveTextContent('~54');
    });
  });
});
