import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CategoryStatus } from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { AdminCategoriesPage } from './AdminCategoriesPage';
import { useAdminCategories } from './use-admin-categories';

const mutations = vi.hoisted(() => ({
  approve: { mutate: vi.fn(), isPending: false },
  rename: { mutate: vi.fn(), isPending: false },
  remove: { mutate: vi.fn(), isPending: false },
}));
let auth: { user: { roles: string[] } | null; loading: boolean };

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../../hooks/useDebouncedValue', () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));
vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock('./use-admin-categories', () => ({
  ADMIN_CATEGORIES_KEY: 'AdminCategoriesInfinite',
  useAdminCategories: vi.fn(),
}));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useApproveCategoryMutation: () => mutations.approve,
  useUpdateCategoryMutation: () => mutations.rename,
  useDeleteCategoryMutation: () => mutations.remove,
}));

const fantasy = {
  id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
  name: 'fantasy',
  status: CategoryStatus.Approved,
  requesterUserId: null,
  approximateNovelCount: 1203,
};
const sliceOfLife = {
  id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
  name: 'slice of life',
  status: CategoryStatus.Pending,
  requesterUserId: '300311094522198754',
  approximateNovelCount: 1,
};

function mockCategories(
  overrides: Partial<ReturnType<typeof useAdminCategories>> = {},
) {
  const loadMore = vi.fn();

  vi.mocked(useAdminCategories).mockReturnValue({
    categories: [fantasy, sliceOfLife],
    isLoading: false,
    isError: false,
    hasMore: false,
    isLoadingMore: false,
    loadMore,
    ...overrides,
  });

  return { loadMore };
}

function renderPage() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');

  render(
    <QueryClientProvider client={client}>
      <AdminCategoriesPage />
    </QueryClientProvider>,
  );

  return { invalidate, user: userEvent.setup() };
}

const rowOf = (name: string) =>
  screen.getByRole('row', { name: new RegExp(name) });

describe('AdminCategoriesPage', () => {
  beforeEach(() => {
    auth = { user: { roles: ['admin'] }, loading: false };
    for (const mutation of Object.values(mutations)) {
      mutation.mutate.mockReset();
      mutation.isPending = false;
    }
    vi.mocked(showApiError).mockReset();
    vi.mocked(showSuccess).mockReset();
    mockCategories();
  });

  describe('access', () => {
    it.each([
      { who: 'a writer', roles: ['writer'] },
      { who: 'a plain user', roles: ['user'] },
    ])(
      'should tell $who they cannot manage categories, and not fetch any',
      ({ roles }) => {
        auth = { user: { roles }, loading: false };

        renderPage();

        expect(
          screen.getByText(
            /don't have permission to manage categories/,
          ),
        ).toBeInTheDocument();
        expect(useAdminCategories).toHaveBeenLastCalledWith(
          '',
          expect.anything(),
          false,
        );
      },
    );

    it('should show a spinner while the user is loading', () => {
      auth = { user: null, loading: true };

      renderPage();

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('list', () => {
    it('shows name, status, requester and the estimated count of every category', () => {
      renderPage();

      expect(
        within(rowOf('fantasy')).getByText('Approved'),
      ).toBeVisible();
      expect(
        within(rowOf('fantasy')).getByText('~1,203'),
      ).toBeVisible();
      expect(
        within(rowOf('slice of life')).getByText('Pending'),
      ).toBeVisible();
      expect(
        within(rowOf('slice of life')).getByText(
          '300311094522198754',
        ),
      ).toBeVisible();
    });

    it('offers Approve on pending categories only', () => {
      renderPage();

      expect(
        within(rowOf('slice of life')).getByRole('button', {
          name: /Approve/,
        }),
      ).toBeVisible();
      expect(
        within(rowOf('fantasy')).queryByRole('button', {
          name: /Approve/,
        }),
      ).not.toBeInTheDocument();
    });

    it.each([
      { action: 'Edit category', button: 'Edit category fantasy' },
      {
        action: 'Delete category',
        button: 'Delete category fantasy',
      },
    ])(
      'gives every row a "$action" button with a tooltip',
      async ({ action, button }) => {
        const { user } = renderPage();

        await user.hover(
          within(rowOf('fantasy')).getByRole('button', {
            name: button,
          }),
        );

        expect(await screen.findByRole('tooltip')).toHaveTextContent(
          action,
        );
      },
    );

    it('shows an empty state', () => {
      mockCategories({ categories: [] });
      renderPage();
      expect(screen.getByText('No category matches.')).toBeVisible();
    });

    it('shows when the categories could not be fetched', () => {
      mockCategories({ categories: [], isError: true });

      renderPage();

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to fetch the categories',
      );
    });
  });

  describe('filters and pagination', () => {
    it('lists every status by default and narrows it with the status buttons', async () => {
      const { user } = renderPage();
      expect(useAdminCategories).toHaveBeenLastCalledWith(
        '',
        [CategoryStatus.Approved, CategoryStatus.Pending],
        true,
      );

      await user.click(
        screen.getByRole('radio', { name: 'Pending' }),
      );

      expect(
        screen.getByRole('radio', { name: 'Pending' }),
      ).toBeChecked();
      expect(useAdminCategories).toHaveBeenLastCalledWith(
        '',
        [CategoryStatus.Pending],
        true,
      );

      await user.click(
        screen.getByRole('radio', { name: 'Approved' }),
      );

      expect(useAdminCategories).toHaveBeenLastCalledWith(
        '',
        [CategoryStatus.Approved],
        true,
      );
    });

    it('searches with the trimmed text', async () => {
      const { user } = renderPage();

      await user.type(
        screen.getByLabelText('Search categories'),
        ' fan ',
      );

      expect(useAdminCategories).toHaveBeenLastCalledWith(
        'fan',
        expect.anything(),
        true,
      );
    });

    it('loads more on demand and hides the button on the last page', async () => {
      const { loadMore } = mockCategories({ hasMore: true });
      const { user } = renderPage();

      await user.click(
        screen.getByRole('button', { name: 'Load more' }),
      );

      expect(loadMore).toHaveBeenCalledOnce();
    });

    it('does not offer Load more on the last page', () => {
      renderPage();

      expect(
        screen.queryByRole('button', { name: 'Load more' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('approve', () => {
    it('approves the category and refreshes the list', async () => {
      const { user, invalidate } = renderPage();
      mutations.approve.mutate.mockImplementation(
        (_variables, options) => options.onSuccess(),
      );

      await user.click(
        within(rowOf('slice of life')).getByRole('button', {
          name: /Approve/,
        }),
      );

      expect(mutations.approve.mutate).toHaveBeenCalledWith(
        { id: sliceOfLife.id },
        expect.any(Object),
      );
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['AdminCategoriesInfinite'],
      });
    });

    it('uses the generic error when approving fails', async () => {
      const { user } = renderPage();
      mutations.approve.mutate.mockImplementation(
        (_variables, options) => options.onError(new Error('boom')),
      );

      await user.click(
        within(rowOf('slice of life')).getByRole('button', {
          name: /Approve/,
        }),
      );

      expect(showApiError).toHaveBeenCalledOnce();
    });
  });

  describe('rename', () => {
    async function startEditing(
      user: ReturnType<typeof userEvent.setup>,
    ) {
      await user.click(
        screen.getByRole('button', { name: 'Edit category fantasy' }),
      );

      return screen.getByLabelText('New name of fantasy');
    }

    it('turns the name into an input, saves with Enter and refreshes the list', async () => {
      const { user, invalidate } = renderPage();
      mutations.rename.mutate.mockImplementation(
        (_variables, options) => options.onSuccess(),
      );
      const input = await startEditing(user);

      await user.clear(input);
      await user.type(input, ' High Fantasy {Enter}');

      expect(mutations.rename.mutate).toHaveBeenCalledWith(
        { id: fantasy.id, name: 'High Fantasy' },
        expect.any(Object),
      );
      expect(
        screen.queryByLabelText('New name of fantasy'),
      ).not.toBeInTheDocument();
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['AdminCategoriesInfinite'],
      });
    });

    it('cancels with Escape and with the Cancel button without saving', async () => {
      const { user } = renderPage();
      const input = await startEditing(user);
      await user.type(input, 'x{Escape}');
      expect(
        screen.queryByLabelText('New name of fantasy'),
      ).not.toBeInTheDocument();

      await startEditing(user);
      await user.click(
        screen.getByRole('button', { name: 'Cancel' }),
      );

      expect(
        screen.queryByLabelText('New name of fantasy'),
      ).not.toBeInTheDocument();
      expect(mutations.rename.mutate).not.toHaveBeenCalled();
    });

    it('does not call the API when the name did not change', async () => {
      const { user } = renderPage();
      const input = await startEditing(user);

      await user.type(input, '{Enter}');

      expect(mutations.rename.mutate).not.toHaveBeenCalled();
      expect(
        screen.queryByLabelText('New name of fantasy'),
      ).not.toBeInTheDocument();
    });

    it('shows the refusal of an existing name next to the input and keeps editing', async () => {
      const { user } = renderPage();
      const message =
        'The category "mystery" already exists or was already requested. Search for "mystery" instead.';
      mutations.rename.mutate.mockImplementation(
        (_variables, options) =>
          options.onError(
            new GraphqlRequestError(message, { code: 'BAD_REQUEST' }),
          ),
      );
      const input = await startEditing(user);

      await user.clear(input);
      await user.type(input, 'Mystery{Enter}');

      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(showApiError).not.toHaveBeenCalled();
      expect(
        screen.getByLabelText('New name of fantasy'),
      ).toBeVisible();
    });

    it('uses the generic error for anything else', async () => {
      const { user } = renderPage();
      mutations.rename.mutate.mockImplementation(
        (_variables, options) =>
          options.onError(new TypeError('Failed to fetch')),
      );
      const input = await startEditing(user);

      await user.type(input, 'x{Enter}');

      expect(showApiError).toHaveBeenCalledOnce();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('delete', () => {
    it('tells how many novels an approved category will be removed from', async () => {
      const { user } = renderPage();

      await user.click(
        screen.getByRole('button', {
          name: 'Delete category fantasy',
        }),
      );

      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByText(
          /"fantasy" will be removed from about 1,203 novels\. The novels themselves stay\./,
        ),
      ).toBeVisible();
      expect(
        within(dialog).getByRole('button', { name: 'Delete' }),
      ).toBeVisible();
    });

    it('says a pending request is rejected', async () => {
      const { user } = renderPage();

      await user.click(
        screen.getByRole('button', {
          name: 'Delete category slice of life',
        }),
      );

      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByText(
          'The request for "slice of life" will be rejected and removed.',
        ),
      ).toBeVisible();
      expect(
        within(dialog).getByRole('button', { name: 'Reject' }),
      ).toBeVisible();
    });

    it('deletes after the confirmation, confirms and refreshes the list', async () => {
      const { user, invalidate } = renderPage();
      mutations.remove.mutate.mockImplementation(
        (_variables, options) => options.onSuccess(),
      );
      await user.click(
        screen.getByRole('button', {
          name: 'Delete category fantasy',
        }),
      );

      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Delete',
        }),
      );

      expect(mutations.remove.mutate).toHaveBeenCalledWith(
        { id: fantasy.id },
        expect.any(Object),
      );
      expect(showSuccess).toHaveBeenCalledWith(
        '"fantasy" was deleted.',
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['AdminCategoriesInfinite'],
      });
    });

    it('deletes nothing when the confirmation is cancelled', async () => {
      const { user } = renderPage();
      await user.click(
        screen.getByRole('button', {
          name: 'Delete category fantasy',
        }),
      );

      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Cancel',
        }),
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mutations.remove.mutate).not.toHaveBeenCalled();
    });

    it('uses the generic error when deleting fails', async () => {
      const { user } = renderPage();
      mutations.remove.mutate.mockImplementation(
        (_variables, options) => options.onError(new Error('boom')),
      );
      await user.click(
        screen.getByRole('button', {
          name: 'Delete category fantasy',
        }),
      );

      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Delete',
        }),
      );

      expect(showApiError).toHaveBeenCalledOnce();
    });
  });
});
