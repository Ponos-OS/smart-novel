import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import {
  LicenseSourceType,
  NovelAction,
  NovelState,
} from '../../generated/graphql';
import { showApiError } from '../../utils/notification';
import { NovelEditPage } from './NovelEditPage';

const novelId = '78981754-46c4-4521-9216-b9b27dafeab2';
const updateNovelMutate = vi.fn();
const deleteNovelMutate = vi.fn();
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
    useCanonicalLicensesQuery: () => ({
      data: { canonicalLicenses: [] },
    }),
    useCanonicalLicenseQuery: () => ({ data: undefined }),
    useUpdateNovelMutation: () => ({
      mutate: updateNovelMutate,
      isPending: false,
    }),
    useDeleteNovelMutation: () => ({
      mutate: deleteNovelMutate,
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

const ccBy = {
  id: '3f7b0c1e-6d52-4b8a-9a41-5c2e8d7f1a06',
  name: 'CC BY 4.0',
  sourceType: LicenseSourceType.Canonical,
  canonicalId: 'CC-BY-4.0',
  text: 'Attribution 4.0 International',
};

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
      license: ccBy,
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
      { path: '/', element: <div>Home page</div> },
    ],
    { initialEntries: [`/novels/${novelId}/edit`] },
  );

  return render(<RouterProvider router={router} />);
}

describe('NovelEditPage', () => {
  beforeEach(() => {
    updateNovelMutate.mockReset();
    deleteNovelMutate.mockReset();
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

  describe('deleting the novel', () => {
    function openDeleteDialog() {
      fireEvent.click(
        screen.getByRole('button', { name: 'Delete novel' }),
      );

      return within(screen.getByRole('dialog'));
    }

    it('changes nothing when the dialog is cancelled', () => {
      // Arrange
      renderPage();
      const dialog = openDeleteDialog();

      // Act
      fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(deleteNovelMutate).not.toHaveBeenCalled();
    });

    it('keeps the confirm button disabled until the exact novel name is typed', () => {
      // Arrange
      renderPage();
      const dialog = openDeleteDialog();

      // Act
      fireEvent.change(dialog.getByRole('textbox'), {
        target: { value: 'The Lantern' },
      });

      // Assert
      expect(
        dialog.getByRole('button', { name: 'Delete' }),
      ).toBeDisabled();

      // Act
      fireEvent.change(dialog.getByRole('textbox'), {
        target: { value: 'The Lantern Keeper' },
      });

      // Assert
      expect(
        dialog.getByRole('button', { name: 'Delete' }),
      ).toBeEnabled();
    });

    it('deletes the novel and goes to the home page', async () => {
      // Arrange
      deleteNovelMutate.mockImplementation((_variables, options) => {
        options.onSuccess();
      });
      renderPage();
      const dialog = openDeleteDialog();
      fireEvent.change(dialog.getByRole('textbox'), {
        target: { value: 'The Lantern Keeper' },
      });

      // Act
      fireEvent.click(dialog.getByRole('button', { name: 'Delete' }));

      // Assert
      expect(deleteNovelMutate).toHaveBeenCalledExactlyOnceWith(
        { id: novelId },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
      expect(await screen.findByText('Home page')).toBeTruthy();
    });

    it('shows the error in the open dialog when the delete fails', () => {
      // Arrange
      deleteNovelMutate.mockImplementation((_variables, options) => {
        options.onError(
          new Error(
            'You do not have permission to delete this novel',
          ),
        );
      });
      renderPage();
      const dialog = openDeleteDialog();
      fireEvent.change(dialog.getByRole('textbox'), {
        target: { value: 'The Lantern Keeper' },
      });

      // Act
      fireEvent.click(dialog.getByRole('button', { name: 'Delete' }));

      // Assert
      expect(dialog.getByRole('alert')).toHaveTextContent(
        'You do not have permission to delete this novel',
      );
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
  });
});
