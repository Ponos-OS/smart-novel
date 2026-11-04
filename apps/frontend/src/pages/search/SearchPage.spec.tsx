import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { showApiError } from '../../utils/notification';
import { SearchPage } from './SearchPage';
import { useFilterTags } from './use-filter-tags';

const search = vi.hoisted(() => ({ useSearchNovelsQuery: vi.fn() }));

vi.mock('../../hooks/useDebouncedValue', () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));
vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
}));
vi.mock('./use-filter-tags', () => ({
  useFilterTags: vi.fn(),
}));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useSearchNovelsQuery: search.useSearchNovelsQuery,
}));

function mockTags(
  overrides: Partial<ReturnType<typeof useFilterTags>> = {},
) {
  const loadMore = vi.fn();

  vi.mocked(useFilterTags).mockReturnValue({
    tags: [
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
    mockTags();
    vi.mocked(showApiError).mockReset();
    search.useSearchNovelsQuery.mockReset();
    search.useSearchNovelsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
  });

  it('shows the tags capitalized, with their estimated counts', () => {
    renderPage();

    const include = within(
      screen.getByRole('heading', { name: 'Include Tags' })
        .parentElement!,
    );
    expect(
      include.getByRole('button', { name: /Fantasy/ }),
    ).toHaveTextContent('~1.2K');
    expect(
      include.getByRole('button', { name: /Mystery/ }),
    ).toHaveTextContent('~87');
  });

  it('shows a loading and an error state for the tags', () => {
    mockTags({ tags: [], isLoading: true });
    renderPage();
    expect(screen.getByText('Loading tags...')).toBeVisible();
  });

  it('notifies when the tags could not be loaded, once', () => {
    mockTags({ tags: [], isError: true });

    renderPage();

    expect(showApiError).toHaveBeenCalledExactlyOnceWith(
      'The tags could not be loaded. Try again later.',
    );
  });

  it('does not notify when the tags were loaded', () => {
    renderPage();

    expect(showApiError).not.toHaveBeenCalled();
  });

  it('loads more tags on demand', async () => {
    const { loadMore } = mockTags({ hasMore: true });
    const user = renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Show more tags' }),
    );

    expect(loadMore).toHaveBeenCalledOnce();
  });

  it('searches with the included and the excluded tags', async () => {
    const user = renderPage();
    await user.click(
      within(
        screen.getByRole('heading', { name: 'Include Tags' })
          .parentElement!,
      ).getByRole('button', { name: /Fantasy/ }),
    );
    await user.click(
      within(
        screen.getByRole('heading', { name: 'Exclude Tags' })
          .parentElement!,
      ).getByRole('button', { name: /Mystery/ }),
    );

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(search.useSearchNovelsQuery).toHaveBeenLastCalledWith(
      {
        filters: { tags: { in: ['Fantasy'], nin: ['Mystery'] } },
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

  describe('searching the tags', () => {
    it('asks for all of them first, then for the ones matching what is typed', async () => {
      const user = renderPage();
      expect(useFilterTags).toHaveBeenLastCalledWith('');

      await user.type(screen.getByLabelText('Search tags'), '  sci ');

      expect(useFilterTags).toHaveBeenLastCalledWith('sci');
    });

    it('says it is searching while the next list loads', () => {
      mockTags({ isFetching: true });

      renderPage();

      expect(screen.getByRole('status')).toHaveTextContent(
        'Searching',
      );
    });

    it('keeps a picked tag visible when a later search does not list it', async () => {
      const user = renderPage();
      await user.click(
        within(
          screen.getByRole('heading', { name: 'Include Tags' })
            .parentElement!,
        ).getByRole('button', { name: /Fantasy/ }),
      );
      mockTags({
        tags: [
          {
            id: '3c1d9a52-7e08-4f6b-b2a4-91d05c7e6f13',
            name: 'sci-fi',
            approximateNovelCount: 54,
          },
        ],
      });

      await user.type(screen.getByLabelText('Search tags'), 'sci');

      const include = within(
        screen.getByRole('heading', { name: 'Include Tags' })
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
