import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { useCanCreateNovel } from '../../hooks/useCanCreateNovel';
import { showApiError } from '../../utils/notification';
import { NovelCreatePage } from './NovelCreatePage';

const createNovelMutate = vi.fn();

vi.mock('../../generated/graphql', async () => {
  const actual = await vi.importActual<
    typeof import('../../generated/graphql')
  >('../../generated/graphql');

  return {
    ...actual,
    useCreateNovelMutation: () => ({
      mutate: createNovelMutate,
      isPending: false,
    }),
  };
});

vi.mock('../../hooks/useCanCreateNovel', () => ({
  useCanCreateNovel: vi.fn(),
}));

vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
}));

function renderPage() {
  const router = createMemoryRouter(
    [
      {
        path: '/novels/new',
        element: (
          <QueryClientProvider client={new QueryClient()}>
            <NovelCreatePage />
          </QueryClientProvider>
        ),
      },
      { path: '/novel/:id', element: <div>Novel page</div> },
    ],
    { initialEntries: ['/novels/new'] },
  );

  return render(<RouterProvider router={router} />);
}

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText('Novel name'), {
    target: { value: 'The Lantern Keeper' },
  });
  fireEvent.change(screen.getByPlaceholderText('Author'), {
    target: { value: 'Jane Doe' },
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
          author: 'Jane Doe',
          description: '',
          state: 'ONGOING',
          categories: [],
        },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(await screen.findByText('Novel page')).toBeTruthy();
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
    expect(screen.getByPlaceholderText('Author')).toHaveValue(
      'Jane Doe',
    );
  });
});
