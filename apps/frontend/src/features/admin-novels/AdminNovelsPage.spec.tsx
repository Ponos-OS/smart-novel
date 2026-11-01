import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import {
  NovelOrderField,
  NovelState,
  OrderDirection,
} from '../../generated/graphql';
import { showApiError, showSuccess } from '../../utils/notification';
import { AdminNovelsPage } from './AdminNovelsPage';
import { useAdminNovels } from './use-admin-novels';
import { useWriterSuggestions } from './use-writer-suggestions';

const mutations = vi.hoisted(() => ({
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
vi.mock('./ContentStatsCards', () => ({
  ContentStatsCards: () => null,
}));
vi.mock('./use-admin-novels', () => ({
  ADMIN_NOVELS_KEY: 'AdminNovelsInfinite',
  useAdminNovels: vi.fn(),
}));
vi.mock('./use-writer-suggestions', () => ({
  useWriterSuggestions: vi.fn(),
}));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useDeleteNovelMutation: () => mutations.remove,
}));

const mina = {
  userId: '364554362883670018',
  penName: 'Mina_Ardalan',
  name: 'Mina Ardalan',
  email: 'mina.ardalan@example.com',
};
const omid = {
  userId: '364554362732740610',
  penName: 'Omid_Rahimi',
  name: 'Omid Rahimi',
  email: 'omid.rahimi@example.com',
};
const lantern = {
  id: 'c1d31ec2-f478-4648-b90b-d1e53de2a829',
  name: 'The Lantern Keeper',
  state: NovelState.Ongoing,
  firstChapterCreatedAt: '2026-10-30T09:15:00.000Z',
  estimatedChapterCount: 1203,
  license: { id: '3f7b0c1e', name: 'CC BY 4.0' },
  writer: mina,
};
const salt = {
  id: '248c9fee-cad0-43fc-9abb-c2ab8ff002ec',
  name: 'The Salt Road',
  state: NovelState.Finished,
  firstChapterCreatedAt: null,
  estimatedChapterCount: 1,
  license: { id: '8e9a1b6d', name: 'CC0 1.0' },
  writer: { userId: omid.userId, penName: omid.penName },
};

function mockNovels(
  overrides: Partial<ReturnType<typeof useAdminNovels>> = {},
) {
  const loadMore = vi.fn();

  vi.mocked(useAdminNovels).mockReturnValue({
    novels: [lantern, salt] as never,
    isLoading: false,
    isError: false,
    hasMore: false,
    isLoadingMore: false,
    loadMore,
    ...overrides,
  });

  return { loadMore };
}

function mockWriters(writers = [mina, omid]) {
  vi.mocked(useWriterSuggestions).mockReturnValue({
    writers,
    isLoading: false,
    isError: false,
    hasMore: false,
    isLoadingMore: false,
    loadMore: vi.fn(),
  });
}

function renderPage() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');

  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AdminNovelsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );

  return { invalidate, user: userEvent.setup() };
}

const rowOf = (name: string) =>
  screen.getByRole('row', { name: new RegExp(name) });
const lastCall = () => {
  const calls = vi.mocked(useAdminNovels).mock.calls;

  return calls[calls.length - 1];
};

describe('AdminNovelsPage', () => {
  beforeEach(() => {
    auth = { user: { roles: ['admin'] }, loading: false };
    mutations.remove.mutate.mockReset();
    mutations.remove.isPending = false;
    vi.mocked(showApiError).mockReset();
    vi.mocked(showSuccess).mockReset();
    vi.mocked(useAdminNovels).mockReset();
    mockNovels();
    mockWriters();
  });

  describe('access', () => {
    it.each([
      { who: 'a writer', roles: ['writer'] },
      { who: 'a plain user', roles: ['user'] },
    ])(
      'should tell $who they cannot manage novels, and not fetch any',
      ({ roles }) => {
        auth = { user: { roles }, loading: false };

        renderPage();

        expect(
          screen.getByText(/don't have permission to manage novels/),
        ).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        expect(lastCall()[2]).toBeFalse();
      },
    );

    it('should wait for the user before deciding', () => {
      auth = { user: null, loading: true };

      renderPage();

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('list', () => {
    it('should ask for the first page with no filter and the default order, for an admin', () => {
      renderPage();

      expect(lastCall()).toStrictEqual([undefined, undefined, true]);
    });

    it('should show the pen name with the real name and email under it, the estimate, the license and the date', () => {
      renderPage();

      const row = rowOf('The Lantern Keeper');

      expect(within(row).getByText('Mina_Ardalan')).toBeVisible();
      expect(
        within(row).getByText(
          'Mina Ardalan · mina.ardalan@example.com',
        ),
      ).toBeVisible();
      expect(within(row).getByText('~1,203')).toBeVisible();
      expect(within(row).getByText('CC BY 4.0')).toBeVisible();
      expect(within(row).getByText('10/30/2026')).toBeVisible();
      expect(within(row).getByText('Ongoing')).toBeVisible();
    });

    it('should show the user ID of a writer whose name and email are not known, and a dash for a novel without a chapter', () => {
      renderPage();

      const row = rowOf('The Salt Road');

      expect(within(row).getByText('Omid_Rahimi')).toBeVisible();
      expect(within(row).getByText(omid.userId)).toBeVisible();
      expect(
        within(row).getByText('-', { selector: 'td' }),
      ).toBeVisible();
    });

    it('should link every novel to its page', () => {
      renderPage();

      expect(
        screen.getByRole('link', { name: 'The Lantern Keeper' }),
      ).toHaveAttribute('href', `/novel/${lantern.id}`);
    });

    it('should show a loading state', () => {
      mockNovels({ novels: [], isLoading: true });

      renderPage();

      expect(screen.getByRole('status')).toHaveTextContent(
        'Loading novels...',
      );
    });

    it('should show an error', () => {
      mockNovels({ novels: [], isError: true });

      renderPage();

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to fetch the novels',
      );
    });

    it('should say when no novel matches', () => {
      mockNovels({ novels: [] });

      renderPage();

      expect(screen.getByText('No novel matches.')).toBeVisible();
    });

    it('should load more on demand, and say so while it does', async () => {
      const { loadMore } = mockNovels({ hasMore: true });
      const { user } = renderPage();

      await user.click(
        screen.getByRole('button', { name: 'Load more' }),
      );

      expect(loadMore).toHaveBeenCalledOnce();
    });
  });

  describe('filters', () => {
    it('should send the chapter range as numbers', async () => {
      const { user } = renderPage();

      await user.type(screen.getByLabelText('Minimum chapters'), '2');
      await user.type(
        screen.getByLabelText('Maximum chapters'),
        '40',
      );

      expect(lastCall()[0]).toStrictEqual({
        chapterCount: { min: 2, max: 40 },
      });
    });

    it('should not send a range the server would refuse, and say what is wrong', async () => {
      const { user } = renderPage();

      await user.type(
        screen.getByLabelText('Minimum chapters'),
        '10',
      );
      await user.type(screen.getByLabelText('Maximum chapters'), '2');

      expect(screen.getByRole('alert')).toHaveTextContent(
        'The maximum is below the minimum',
      );
      expect(lastCall()[0]).toBeUndefined();
    });

    it('should send the state', async () => {
      const { user } = renderPage();

      await user.selectOptions(
        screen.getByLabelText('State'),
        'Finished',
      );

      expect(lastCall()[0]).toStrictEqual({
        state: NovelState.Finished,
      });
    });

    it('should send the first chapter days as whole days in UTC, and say when the end is before the start', async () => {
      const { user } = renderPage();

      await user.type(
        screen.getByLabelText('First chapter from'),
        '2026-01-01',
      );
      await user.type(
        screen.getByLabelText('First chapter to'),
        '2026-06-30',
      );

      expect(lastCall()[0]).toStrictEqual({
        firstChapterCreatedAt: {
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-06-30T23:59:59.999Z',
        },
      });

      await user.clear(screen.getByLabelText('First chapter to'));
      await user.type(
        screen.getByLabelText('First chapter to'),
        '2025-12-31',
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'The end is before the start',
      );
    });

    it('should send the user IDs of the writers that were picked, and show them as chips that can be removed', async () => {
      const { user } = renderPage();
      const combobox = screen.getByRole('combobox', {
        name: 'Writers',
      });

      await user.click(combobox);
      await user.click(
        within(screen.getByRole('listbox')).getByText('Mina_Ardalan'),
      );
      await user.click(combobox);
      await user.click(
        within(screen.getByRole('listbox')).getByText('Omid_Rahimi'),
      );

      expect(lastCall()[0]).toStrictEqual({
        ownerIds: [mina.userId, omid.userId],
      });
      expect(
        within(
          screen.getByRole('list', { name: 'Selected writers' }),
        ).getAllByRole('listitem'),
      ).toHaveLength(2);

      await user.click(
        screen.getByRole('button', { name: 'Remove Mina_Ardalan' }),
      );

      expect(lastCall()[0]).toStrictEqual({
        ownerIds: [omid.userId],
      });
    });

    it('should show the pen name, the name and the email in each suggestion, and search by what was typed', async () => {
      const { user } = renderPage();

      await user.type(
        screen.getByRole('combobox', { name: 'Writers' }),
        'mina',
      );

      const option = within(screen.getByRole('listbox')).getByRole(
        'option',
        { name: /Mina_Ardalan/ },
      );
      expect(option).toHaveTextContent(
        'Mina_ArdalanMina Ardalan · mina.ardalan@example.com',
      );
      expect(useWriterSuggestions).toHaveBeenLastCalledWith(
        'mina',
        true,
      );
    });

    it('should clear every filter with one action', async () => {
      const { user } = renderPage();
      await user.selectOptions(
        screen.getByLabelText('State'),
        'Finished',
      );
      await user.type(screen.getByLabelText('Minimum chapters'), '2');
      const clear = screen.getByRole('button', {
        name: 'Clear filters',
      });

      await user.click(clear);

      expect(lastCall()[0]).toBeUndefined();
      expect(screen.getByLabelText('Minimum chapters')).toHaveValue(
        null,
      );
      expect(clear).toBeDisabled();
    });
  });

  describe('sort', () => {
    const sortOf = () => lastCall()[1];
    const header = () =>
      screen.getByRole('columnheader', { name: /First chapter/ });

    it('should be by name until a sort arrow is pressed', () => {
      renderPage();

      expect(sortOf()).toBeUndefined();
      expect(header()).toHaveAttribute('aria-sort', 'none');
    });

    it('should sort the oldest first chapter first with the up arrow, and the newest with the down arrow', async () => {
      const { user } = renderPage();

      await user.click(
        screen.getByRole('button', {
          name: 'Sort by first chapter, oldest first',
        }),
      );

      expect(sortOf()).toStrictEqual({
        field: NovelOrderField.FirstChapterCreatedAt,
        direction: OrderDirection.Asc,
      });
      expect(header()).toHaveAttribute('aria-sort', 'ascending');

      await user.click(
        screen.getByRole('button', {
          name: 'Sort by first chapter, newest first',
        }),
      );

      expect(sortOf()).toStrictEqual({
        field: NovelOrderField.FirstChapterCreatedAt,
        direction: OrderDirection.Desc,
      });
      expect(header()).toHaveAttribute('aria-sort', 'descending');
    });

    it('should highlight the active arrow, and go back to the name order when it is pressed again', async () => {
      const { user } = renderPage();
      const oldest = screen.getByRole('button', {
        name: 'Sort by first chapter, oldest first',
      });

      await user.click(oldest);

      expect(oldest).toHaveAttribute('aria-pressed', 'true');

      await user.click(oldest);

      expect(oldest).toHaveAttribute('aria-pressed', 'false');
      expect(sortOf()).toBeUndefined();
    });
  });

  describe('deleting', () => {
    it('should ask first, naming the novel and its writer, and not delete when cancelled', async () => {
      const { user } = renderPage();

      await user.click(
        screen.getByRole('button', {
          name: 'Delete The Lantern Keeper',
        }),
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('The Lantern Keeper');
      expect(dialog).toHaveTextContent('Mina_Ardalan');
      expect(dialog).toHaveTextContent('chapters, read history');

      await user.click(
        within(dialog).getByRole('button', { name: 'Cancel' }),
      );

      expect(mutations.remove.mutate).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should delete by the ID, say so, refresh the list and close the dialog', async () => {
      const { user, invalidate } = renderPage();
      mutations.remove.mutate.mockImplementation(
        (_variables, options) => options.onSuccess(),
      );
      await user.click(
        screen.getByRole('button', {
          name: 'Delete The Lantern Keeper',
        }),
      );

      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Delete',
        }),
      );

      expect(mutations.remove.mutate).toHaveBeenCalledExactlyOnceWith(
        { id: lantern.id },
        expect.any(Object),
      );
      expect(showSuccess).toHaveBeenCalledWith(
        '"The Lantern Keeper" was deleted.',
      );
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['AdminNovelsInfinite'],
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should keep the dialog open with the error when the deletion fails, so it can be tried again', async () => {
      const { user } = renderPage();
      mutations.remove.mutate.mockImplementation(
        (_variables, options) => options.onError(new Error('boom')),
      );
      await user.click(
        screen.getByRole('button', {
          name: 'Delete The Lantern Keeper',
        }),
      );

      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Delete',
        }),
      );

      expect(screen.getByRole('dialog')).toHaveTextContent(
        'Could not delete the novel. Try again.',
      );
      expect(showApiError).toHaveBeenCalledOnce();
      expect(showSuccess).not.toHaveBeenCalled();
    });
  });
});
