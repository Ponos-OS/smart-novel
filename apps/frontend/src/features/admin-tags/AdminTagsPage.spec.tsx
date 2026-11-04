import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TagStatus } from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { AdminTagsPage } from './AdminTagsPage';
import { useAdminTags } from './use-admin-tags';

const mutations = vi.hoisted(() => ({
  approve: { mutate: vi.fn(), isPending: false },
  rename: { mutate: vi.fn(), isPending: false },
  remove: { mutate: vi.fn(), isPending: false },
  create: { mutate: vi.fn(), isPending: false },
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
vi.mock('./use-admin-tags', () => ({
  ADMIN_TAGS_KEY: 'AdminTagsInfinite',
  useAdminTags: vi.fn(),
}));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useApproveTagMutation: () => mutations.approve,
  useUpdateTagMutation: () => mutations.rename,
  useDeleteTagMutation: () => mutations.remove,
  useCreateTagMutation: () => mutations.create,
}));

const fantasy = {
  id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
  name: 'fantasy',
  description: 'Worlds with magic, mythical creatures and quests.',
  status: TagStatus.Approved,
  requesterUserId: null,
  approximateNovelCount: 1203,
};
const sliceOfLife = {
  id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
  name: 'slice of life',
  description: '',
  status: TagStatus.Pending,
  requesterUserId: '300311094522198754',
  approximateNovelCount: 1,
};

function mockTags(
  overrides: Partial<ReturnType<typeof useAdminTags>> = {},
) {
  const loadMore = vi.fn();

  vi.mocked(useAdminTags).mockReturnValue({
    tags: [fantasy, sliceOfLife],
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
      <AdminTagsPage />
    </QueryClientProvider>,
  );

  return { invalidate, user: userEvent.setup() };
}

const rowOf = (name: string) =>
  screen.getByRole('row', { name: new RegExp(name) });

describe('AdminTagsPage', () => {
  beforeEach(() => {
    auth = { user: { roles: ['admin'] }, loading: false };
    for (const mutation of Object.values(mutations)) {
      mutation.mutate.mockReset();
      mutation.isPending = false;
    }
    vi.mocked(showApiError).mockReset();
    vi.mocked(showSuccess).mockReset();
    mockTags();
  });

  describe('access', () => {
    it.each([
      { who: 'a writer', roles: ['writer'] },
      { who: 'a plain user', roles: ['user'] },
    ])(
      'should tell $who they cannot manage tags, and not fetch any',
      ({ roles }) => {
        auth = { user: { roles }, loading: false };

        renderPage();

        expect(
          screen.getByText(/don't have permission to manage tags/),
        ).toBeInTheDocument();
        expect(useAdminTags).toHaveBeenLastCalledWith(
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
    it('shows name, status, requester and the estimated count of every tag', () => {
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

    it('offers Approve on pending tags only', () => {
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
      { action: 'Edit tag', button: 'Edit tag fantasy' },
      {
        action: 'Delete tag',
        button: 'Delete tag fantasy',
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
      mockTags({ tags: [] });
      renderPage();
      expect(screen.getByText('No tag matches.')).toBeVisible();
    });

    it('shows when the tags could not be fetched', () => {
      mockTags({ tags: [], isError: true });

      renderPage();

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to fetch the tags',
      );
    });
  });

  describe('filters and pagination', () => {
    it('lists every status by default and narrows it with the status buttons', async () => {
      const { user } = renderPage();
      expect(useAdminTags).toHaveBeenLastCalledWith(
        '',
        [TagStatus.Approved, TagStatus.Pending],
        true,
      );

      await user.click(
        screen.getByRole('radio', { name: 'Pending' }),
      );

      expect(
        screen.getByRole('radio', { name: 'Pending' }),
      ).toBeChecked();
      expect(useAdminTags).toHaveBeenLastCalledWith(
        '',
        [TagStatus.Pending],
        true,
      );

      await user.click(
        screen.getByRole('radio', { name: 'Approved' }),
      );

      expect(useAdminTags).toHaveBeenLastCalledWith(
        '',
        [TagStatus.Approved],
        true,
      );
    });

    it('searches with the trimmed text', async () => {
      const { user } = renderPage();

      await user.type(screen.getByLabelText('Search tags'), ' fan ');

      expect(useAdminTags).toHaveBeenLastCalledWith(
        'fan',
        expect.anything(),
        true,
      );
    });

    it('loads more on demand and hides the button on the last page', async () => {
      const { loadMore } = mockTags({ hasMore: true });
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
    it('approves the tag and refreshes the list', async () => {
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
        queryKey: ['AdminTagsInfinite'],
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

  describe('description', () => {
    async function startEditing(
      user: ReturnType<typeof userEvent.setup>,
    ) {
      await user.click(
        screen.getByRole('button', { name: 'Edit tag fantasy' }),
      );

      return screen.getByLabelText('Description of fantasy');
    }

    it('shows the description under the name', () => {
      renderPage();

      expect(
        within(rowOf('fantasy')).getByText(fantasy.description),
      ).toBeVisible();
    });

    it('sends only the description when only it changed, trimmed, and refreshes the list', async () => {
      const { user, invalidate } = renderPage();
      mutations.rename.mutate.mockImplementation(
        (_variables, options) => options.onSuccess(),
      );
      const textarea = await startEditing(user);

      await user.clear(textarea);
      await user.type(textarea, '  Swords and sorcery.  ');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(mutations.rename.mutate).toHaveBeenCalledExactlyOnceWith(
        {
          id: fantasy.id,
          input: { description: 'Swords and sorcery.' },
        },
        expect.any(Object),
      );
      expect(
        screen.queryByLabelText('Description of fantasy'),
      ).not.toBeInTheDocument();
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['AdminTagsInfinite'],
      });
    });

    it('sends the name and the description together when both changed', async () => {
      const { user } = renderPage();
      const textarea = await startEditing(user);
      const input = screen.getByLabelText('New name of fantasy');

      await user.clear(input);
      await user.type(input, 'Epic');
      await user.clear(textarea);
      await user.type(textarea, 'Grand stories.');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(mutations.rename.mutate).toHaveBeenCalledExactlyOnceWith(
        {
          id: fantasy.id,
          input: { name: 'Epic', description: 'Grand stories.' },
        },
        expect.any(Object),
      );
    });

    it('can clear the description', async () => {
      const { user } = renderPage();
      const textarea = await startEditing(user);

      await user.clear(textarea);
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(mutations.rename.mutate).toHaveBeenCalledExactlyOnceWith(
        { id: fantasy.id, input: { description: '' } },
        expect.any(Object),
      );
    });

    it('does not call the API when nothing changed', async () => {
      const { user } = renderPage();
      await startEditing(user);

      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(mutations.rename.mutate).not.toHaveBeenCalled();
    });

    it('shows a refusal next to the inputs and keeps editing', async () => {
      const { user } = renderPage();
      const message =
        'A tag description can have at most 650 characters';
      mutations.rename.mutate.mockImplementation(
        (_variables, options) =>
          options.onError(
            new GraphqlRequestError(message, { code: 'BAD_REQUEST' }),
          ),
      );
      const textarea = await startEditing(user);

      await user.type(textarea, '!');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(showApiError).not.toHaveBeenCalled();
    });

    it('cancels with Escape without saving', async () => {
      const { user } = renderPage();
      const textarea = await startEditing(user);

      await user.type(textarea, 'x{Escape}');

      expect(
        screen.queryByLabelText('Description of fantasy'),
      ).not.toBeInTheDocument();
      expect(mutations.rename.mutate).not.toHaveBeenCalled();
    });
  });

  describe('rename', () => {
    async function startEditing(
      user: ReturnType<typeof userEvent.setup>,
    ) {
      await user.click(
        screen.getByRole('button', { name: 'Edit tag fantasy' }),
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
        { id: fantasy.id, input: { name: 'High Fantasy' } },
        expect.any(Object),
      );
      expect(
        screen.queryByLabelText('New name of fantasy'),
      ).not.toBeInTheDocument();
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['AdminTagsInfinite'],
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
        'The tag "mystery" already exists or was already requested. Search for "mystery" instead.';
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
    it('tells how many novels an approved tag will be removed from', async () => {
      const { user } = renderPage();

      await user.click(
        screen.getByRole('button', {
          name: 'Delete tag fantasy',
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
          name: 'Delete tag slice of life',
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
          name: 'Delete tag fantasy',
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
        queryKey: ['AdminTagsInfinite'],
      });
    });

    it('deletes nothing when the confirmation is cancelled', async () => {
      const { user } = renderPage();
      await user.click(
        screen.getByRole('button', {
          name: 'Delete tag fantasy',
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
          name: 'Delete tag fantasy',
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

  describe('create', () => {
    async function fillAndSubmit(
      user: ReturnType<typeof userEvent.setup>,
    ) {
      await user.click(
        screen.getByRole('button', { name: 'Create tag' }),
      );
      const dialog = screen.getByRole('dialog');
      await user.type(
        within(dialog).getByLabelText('Tag name'),
        '  Slice Of Life ',
      );
      await user.type(
        within(dialog).getByLabelText('Description'),
        ' Quiet, everyday stories. ',
      );
      await user.click(
        within(dialog).getByRole('button', { name: 'Create tag' }),
      );
    }

    it('creates the tag, closes the dialog and refreshes the list', async () => {
      const { user, invalidate } = renderPage();
      mutations.create.mutate.mockImplementation(
        (_variables, options) =>
          options.onSuccess({
            createTag: { id: fantasy.id, name: 'Slice Of Life' },
          }),
      );

      await fillAndSubmit(user);

      expect(mutations.create.mutate).toHaveBeenCalledWith(
        {
          input: {
            name: 'Slice Of Life',
            description: 'Quiet, everyday stories.',
          },
        },
        expect.any(Object),
      );
      expect(showSuccess).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['AdminTagsInfinite'],
      });
    });

    it('shows the refusal of an existing name and keeps the dialog open', async () => {
      const { user } = renderPage();
      mutations.create.mutate.mockImplementation(
        (_variables, options) =>
          options.onError(
            new GraphqlRequestError(
              'The tag "fantasy" already exists',
              {
                code: 'BAD_REQUEST',
              },
            ),
          ),
      );

      await fillAndSubmit(user);

      expect(
        within(screen.getByRole('dialog')).getByText(
          /already exists/,
        ),
      ).toBeInTheDocument();
      expect(showApiError).not.toHaveBeenCalled();
    });

    it('uses the generic error for anything else', async () => {
      const { user } = renderPage();
      mutations.create.mutate.mockImplementation(
        (_variables, options) => options.onError(new Error('boom')),
      );

      await fillAndSubmit(user);

      expect(showApiError).toHaveBeenCalledOnce();
    });
  });
});
