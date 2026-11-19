import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { ADMIN_NOVELS_KEY } from '../../features/admin-novels/use-admin-novels';
import {
  useContentStatsQuery,
  useGetNovelsQuery,
  useSearchNovelsQuery,
} from '../../generated/graphql';
import { useCanCreateNovel } from '../../hooks/useCanCreateNovel';
import { showApiError } from '../../utils/notification';
import { NovelCreatePage } from './NovelCreatePage';

const createNovelMutate = vi.fn();
const storeLicense = vi.hoisted(() => vi.fn());
const defaultLicense = {
  id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
  name: 'CC BY 4.0',
  sourceType: 'CANONICAL',
  canonicalID: 'CC-BY-4.0',
  text: 'Attribution 4.0 International',
};

vi.mock('./use-tag-suggestions', () => ({
  useTagSuggestions: () => ({
    names: [],
    isLoading: false,
    isError: false,
    hasMore: false,
    isLoadingMore: false,
    loadMore: vi.fn(),
  }),
}));

vi.mock('../../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../../generated/graphql')
  >('../../generated/graphql');

  return {
    ...actual,
    useDefaultLicenseQuery: () => ({ data: { defaultLicense } }),
    useSelectableLicensesQuery: () => ({ data: undefined }),
    useCreateNovelMutation: () => ({
      mutate: createNovelMutate,
      isPending: false,
    }),
  };
});

vi.mock('./use-store-license', () => ({
  useStoreLicense: () => ({ store: storeLicense, isPending: false }),
}));

vi.mock('../../hooks/useCanCreateNovel', () => ({
  useCanCreateNovel: vi.fn(),
}));

vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/novels/new',
        element: (
          <QueryClientProvider client={queryClient}>
            <NovelCreatePage />
          </QueryClientProvider>
        ),
      },
      { path: '/novel/:id', element: <div>Novel page</div> },
    ],
    { initialEntries: ['/novels/new'] },
  );

  render(<RouterProvider router={router} />);

  return { queryClient };
}

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText('Novel name'), {
    target: { value: 'The Lantern Keeper' },
  });
}

describe('NovelCreatePage', () => {
  beforeEach(() => {
    createNovelMutate.mockReset();
    vi.mocked(showApiError).mockReset();
    vi.mocked(useCanCreateNovel).mockReturnValue({
      canCreate: true,
      loading: false,
    });
  });

  it('renders a forbidden view instead of the form when the viewer cannot create a novel', () => {
    // Arrange
    vi.mocked(useCanCreateNovel).mockReturnValue({
      canCreate: false,
      loading: false,
    });

    // Act
    renderPage();

    // Assert
    expect(
      screen.getByText(/don't have permission to create a novel/i),
    ).toBeTruthy();
    expect(screen.queryByPlaceholderText('Novel name')).toBeNull();
  });

  it('creates the novel and lands on its page', async () => {
    // Arrange
    createNovelMutate.mockImplementation((_variables, options) => {
      options.onSuccess({
        createNovel: { id: '78981754-46c4-4521-9216-b9b27dafeab2' },
      });
    });
    renderPage();
    fillRequiredFields();

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Create novel' }),
    );

    // Assert
    expect(createNovelMutate).toHaveBeenCalledExactlyOnceWith(
      {
        input: {
          name: 'The Lantern Keeper',
          description: '',
          state: 'ONGOING',
          tags: [],
        },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(await screen.findByText('Novel page')).toBeTruthy();
  });

  it.each([
    ['the novel list', useGetNovelsQuery.getKey()],
    ['the search results', useSearchNovelsQuery.getKey()],
    ['the admin novel list', [ADMIN_NOVELS_KEY]],
    ['the content counts', useContentStatsQuery.getKey()],
  ])(
    'refreshes %s once the novel is created',
    async (_name, queryKey) => {
      // Arrange
      createNovelMutate.mockImplementation((_variables, options) => {
        options.onSuccess({
          createNovel: { id: '78981754-46c4-4521-9216-b9b27dafeab2' },
        });
      });
      const { queryClient } = renderPage();
      const invalidateQueries = vi.spyOn(
        queryClient,
        'invalidateQueries',
      );
      fillRequiredFields();

      // Act
      fireEvent.click(
        screen.getByRole('button', { name: 'Create novel' }),
      );

      // Assert
      await screen.findByText('Novel page');
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
    },
  );

  it('does not refresh any list when the mutation fails', () => {
    // Arrange
    createNovelMutate.mockImplementation((_variables, options) => {
      options.onError(new Error('Network error'));
    });
    const { queryClient } = renderPage();
    const invalidateQueries = vi.spyOn(
      queryClient,
      'invalidateQueries',
    );
    fillRequiredFields();

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Create novel' }),
    );

    // Assert
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('preselects the default license and stores a license of the writer only after the text is edited', async () => {
    // Arrange
    const storedId = 'b2d9c4aa-18f3-4f0e-9c57-3a6d1e8b7f42';
    storeLicense.mockResolvedValue(storedId);
    renderPage();
    fillRequiredFields();

    // Act
    fireEvent.change(screen.getByLabelText('License text'), {
      target: { value: 'Attribution 4.0 International, no resale.' },
    });
    fireEvent.change(
      screen.getByLabelText('Name of your modified license'),
      { target: { value: 'CC BY 4.0 without resale' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Create novel' }),
    );

    // Assert
    expect(screen.getByText('CC BY 4.0')).toBeTruthy();
    await waitFor(() => expect(createNovelMutate).toHaveBeenCalled());
    expect(storeLicense).toHaveBeenCalledExactlyOnceWith({
      name: 'CC BY 4.0 without resale',
      text: 'Attribution 4.0 International, no resale.',
      sourceType: 'FORKED',
      canonicalID: 'CC-BY-4.0',
    });
    expect(createNovelMutate).toHaveBeenCalledExactlyOnceWith(
      { input: expect.objectContaining({ licenseID: storedId }) },
      expect.anything(),
    );
  });

  it('shows an API error and keeps the entered values when the mutation fails', () => {
    // Arrange
    createNovelMutate.mockImplementation((_variables, options) => {
      options.onError(new Error('Network error'));
    });
    renderPage();
    fillRequiredFields();

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Create novel' }),
    );

    // Assert
    expect(showApiError).toHaveBeenCalledOnce();
    expect(screen.getByPlaceholderText('Novel name')).toHaveValue(
      'The Lantern Keeper',
    );
  });
});
