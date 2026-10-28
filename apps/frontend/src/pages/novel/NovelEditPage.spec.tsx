import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { NovelAction, NovelState } from '../../generated/graphql';
import { showApiError } from '../../utils/notification';
import { NovelEditPage } from './NovelEditPage';

const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';
const updateNovelMutate = vi.fn();
let novelQuery: {
  data?: unknown;
  isLoading: boolean;
  error: unknown;
};

vi.mock('../../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../../generated/graphql')
  >('../../generated/graphql');
  const useGetNovelQuery = () => novelQuery;
  useGetNovelQuery.getKey = actual.useGetNovelQuery.getKey;

  return {
    ...actual,
    useGetNovelQuery,
    useUpdateNovelMutation: () => ({
      mutate: updateNovelMutate,
      isPending: false,
    }),
  };
});

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ loading: false }),
}));

vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
}));

function novel(allowedActions: NovelAction[]) {
  return {
    novel: {
      id: novelId,
      name: 'The Lantern Keeper',
      author: 'Jane Doe',
      description: 'A lighthouse keeper finds a door in the fog.',
      state: NovelState.Ongoing,
      category: ['fantasy', 'adventure'],
      allowedActions,
    },
  };
}

function renderPage() {
  const router = createMemoryRouter(
    [
      {
        path: '/novels/:novelId/edit',
        element: (
          <QueryClientProvider client={new QueryClient()}>
            <NovelEditPage />
          </QueryClientProvider>
        ),
      },
      { path: '/novel/:id', element: <div>Novel page</div> },
    ],
    { initialEntries: [`/novels/${novelId}/edit`] },
  );

  return render(<RouterProvider router={router} />);
}

describe('NovelEditPage', () => {
  beforeEach(() => {
    updateNovelMutate.mockReset();
    vi.mocked(showApiError).mockReset();
    novelQuery = {
      data: novel([NovelAction.EditContent, NovelAction.ManageTts]),
      isLoading: false,
      error: null,
    };
  });

  it('renders a forbidden view instead of the form when the viewer cannot edit the novel', () => {
    // Arrange
    novelQuery.data = novel([]);

    // Act
    renderPage();

    // Assert
    expect(
      screen.getByText(/don't have permission to edit this novel/i),
    ).toBeTruthy();
    expect(screen.queryByPlaceholderText('Novel name')).toBeNull();
  });

  it('prefills the form with the current novel', () => {
    // Act
    renderPage();

    // Assert
    expect(screen.getByPlaceholderText('Novel name')).toHaveValue(
      'The Lantern Keeper',
    );
    expect(
      screen.getByPlaceholderText('fantasy, adventure'),
    ).toHaveValue('fantasy, adventure');
  });

  it('saves the changes and lands on the novel page', async () => {
    // Arrange
    updateNovelMutate.mockImplementation((_variables, options) => {
      options.onSuccess();
    });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Novel name'), {
      target: { value: 'The Lantern Keeper II' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(updateNovelMutate).toHaveBeenCalledExactlyOnceWith(
      {
        id: novelId,
        input: {
          name: 'The Lantern Keeper II',
          author: 'Jane Doe',
          description: 'A lighthouse keeper finds a door in the fog.',
          state: NovelState.Ongoing,
          categories: ['fantasy', 'adventure'],
        },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(await screen.findByText('Novel page')).toBeTruthy();
  });

  it('shows an API error and keeps the edited values when the mutation fails', () => {
    // Arrange
    updateNovelMutate.mockImplementation((_variables, options) => {
      options.onError(new Error('Network error'));
    });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Novel name'), {
      target: { value: 'The Lantern Keeper II' },
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(showApiError).toHaveBeenCalledOnce();
    expect(screen.getByPlaceholderText('Novel name')).toHaveValue(
      'The Lantern Keeper II',
    );
  });
});
