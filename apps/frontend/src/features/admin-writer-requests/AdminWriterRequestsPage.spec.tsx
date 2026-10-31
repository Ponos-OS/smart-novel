import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { WriterRequestStatus } from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { AdminWriterRequestsPage } from './AdminWriterRequestsPage';
import { useAdminWriterRequests } from './use-admin-writer-requests';

const mutations = vi.hoisted(() => ({
  approve: { mutate: vi.fn(), isPending: false },
  reject: { mutate: vi.fn(), isPending: false },
}));
let auth: { user: { roles: string[] } | null; loading: boolean };

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../../utils/notification', () => ({
  showApiError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock('./use-admin-writer-requests', () => ({
  ADMIN_WRITER_REQUESTS_KEY: 'AdminWriterRequestsInfinite',
  useAdminWriterRequests: vi.fn(),
}));
vi.mock('../../generated/graphql', async () => ({
  ...(await vi.importActual('../../generated/graphql')),
  useApproveWriterRequestMutation: () => mutations.approve,
  useRejectWriterRequestMutation: () => mutations.reject,
}));

const mina = {
  id: '5b2c0f3e-0a53-4d3c-9d2c-9a3d1f7f4a10',
  requesterName: 'Mina Ardalan',
  requesterEmail: 'mina.ardalan@example.com',
  note: 'I serialize a fantasy web novel.',
  status: WriterRequestStatus.Pending,
  rejectionReason: null,
  createdAt: '2026-10-30T09:15:00.000Z',
  reviewedAt: null,
};
const omid = {
  id: 'c1d4a7f2-6e58-4b39-8a64-2f0e9b7d3c55',
  requesterName: 'Omid Rahimi',
  requesterEmail: 'omid.rahimi@example.com',
  note: 'I would like to publish poems.',
  status: WriterRequestStatus.Pending,
  rejectionReason: null,
  createdAt: '2026-10-31T08:00:00.000Z',
  reviewedAt: null,
};

function mockRequests(
  overrides: Partial<ReturnType<typeof useAdminWriterRequests>> = {},
) {
  const loadMore = vi.fn();

  vi.mocked(useAdminWriterRequests).mockReturnValue({
    requests: [mina, omid],
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
      <AdminWriterRequestsPage />
    </QueryClientProvider>,
  );

  return { invalidate, user: userEvent.setup() };
}

const rowOf = (name: string) =>
  screen.getByRole('row', { name: new RegExp(name) });

describe('AdminWriterRequestsPage', () => {
  beforeEach(() => {
    auth = { user: { roles: ['admin'] }, loading: false };
    for (const mutation of Object.values(mutations)) {
      mutation.mutate.mockReset();
      mutation.isPending = false;
    }
    vi.mocked(showApiError).mockReset();
    vi.mocked(showSuccess).mockReset();
    mockRequests();
  });

  describe('access', () => {
    it.each([
      { who: 'a writer', roles: ['writer'] },
      { who: 'a plain user', roles: ['user'] },
    ])(
      'should tell $who they cannot review requests, and not fetch any',
      ({ roles }) => {
        auth = { user: { roles }, loading: false };

        renderPage();

        expect(
          screen.getByText(/don't have permission to review/),
        ).toBeInTheDocument();
        expect(useAdminWriterRequests).toHaveBeenLastCalledWith(
          WriterRequestStatus.Pending,
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
    it('lists the pending requests with who asked, the note and the date', () => {
      renderPage();

      const row = rowOf('Mina Ardalan');

      expect(useAdminWriterRequests).toHaveBeenLastCalledWith(
        WriterRequestStatus.Pending,
        true,
      );
      expect(
        within(row).getByText('mina.ardalan@example.com'),
      ).toBeVisible();
      expect(
        within(row).getByText('I serialize a fantasy web novel.'),
      ).toBeVisible();
      expect(within(row).getByText('10/30/2026')).toBeVisible();
      expect(within(row).getByText('Pending')).toBeVisible();
    });

    it('shows a loading state', () => {
      mockRequests({ requests: [], isLoading: true });

      renderPage();

      expect(screen.getByRole('status')).toHaveTextContent(
        'Loading writer requests...',
      );
    });

    it('says so when nothing is pending', () => {
      mockRequests({ requests: [] });

      renderPage();

      expect(screen.getByText('No pending requests.')).toBeVisible();
    });

    it('shows an error when the list cannot be fetched', () => {
      mockRequests({ requests: [], isError: true });

      renderPage();

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Failed to fetch the writer requests',
      );
    });

    it('asks for another status from the filter', async () => {
      const { user } = renderPage();

      await user.click(
        screen.getByRole('radio', { name: 'Rejected' }),
      );

      expect(useAdminWriterRequests).toHaveBeenLastCalledWith(
        WriterRequestStatus.Rejected,
        true,
      );
    });

    it('offers actions on pending requests only, and shows the reason of a rejected one', async () => {
      const { user } = renderPage();
      mockRequests({
        requests: [
          {
            ...mina,
            status: WriterRequestStatus.Rejected,
            rejectionReason: 'Please share a sample chapter.',
          },
        ],
      });

      await user.click(
        screen.getByRole('radio', { name: 'Rejected' }),
      );

      expect(
        screen.queryByRole('button', { name: /Approve|Reject Mina/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText('Please share a sample chapter.'),
      ).toBeVisible();
    });

    it('loads more on demand', async () => {
      const { loadMore } = mockRequests({ hasMore: true });
      const { user } = renderPage();

      await user.click(
        screen.getByRole('button', { name: 'Load more' }),
      );

      expect(loadMore).toHaveBeenCalledOnce();
    });
  });

  describe('approve', () => {
    it('approves in one click, confirms and refreshes the list', async () => {
      const { user, invalidate } = renderPage();
      mutations.approve.mutate.mockImplementation(
        (_variables, options) => options.onSuccess(),
      );

      await user.click(
        within(rowOf('Mina Ardalan')).getByRole('button', {
          name: 'Approve Mina Ardalan',
        }),
      );

      expect(
        mutations.approve.mutate,
      ).toHaveBeenCalledExactlyOnceWith(
        { id: mina.id },
        expect.any(Object),
      );
      expect(showSuccess).toHaveBeenCalledWith(
        expect.stringContaining('Mina Ardalan is a writer now'),
      );
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['AdminWriterRequestsInfinite'],
      });
    });

    it('shows an error and keeps the row when the mutation fails', async () => {
      const { user, invalidate } = renderPage();
      mutations.approve.mutate.mockImplementation(
        (_variables, options) =>
          options.onError(
            new GraphqlRequestError('boom', {
              code: 'INTERNAL_SERVER_ERROR',
            }),
          ),
      );

      await user.click(
        within(rowOf('Mina Ardalan')).getByRole('button', {
          name: 'Approve Mina Ardalan',
        }),
      );

      expect(showApiError).toHaveBeenCalledWith(
        expect.stringContaining('stays pending'),
      );
      expect(showSuccess).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
      expect(rowOf('Mina Ardalan')).toBeVisible();
    });

    it('shows the server message and refreshes when somebody reviewed it already', async () => {
      const { user, invalidate } = renderPage();
      mutations.approve.mutate.mockImplementation(
        (_variables, options) =>
          options.onError(
            new GraphqlRequestError(
              'This writer request was already reviewed',
              { code: 'BAD_REQUEST' },
            ),
          ),
      );

      await user.click(
        within(rowOf('Mina Ardalan')).getByRole('button', {
          name: 'Approve Mina Ardalan',
        }),
      );

      expect(showApiError).toHaveBeenCalledWith(
        'This writer request was already reviewed',
      );
      expect(invalidate).toHaveBeenCalledOnce();
    });

    it('blocks both actions of the row while the approval is in flight', () => {
      mutations.approve.isPending = true;

      renderPage();

      const row = within(rowOf('Mina Ardalan'));

      expect(
        row.getByRole('button', { name: 'Approve Mina Ardalan' }),
      ).toBeDisabled();
      expect(
        row.getByRole('button', { name: 'Reject Mina Ardalan' }),
      ).toBeDisabled();
    });
  });

  describe('reject', () => {
    async function openRejectDialog() {
      const { user, invalidate } = renderPage();

      await user.click(
        within(rowOf('Mina Ardalan')).getByRole('button', {
          name: 'Reject Mina Ardalan',
        }),
      );

      return { user, invalidate };
    }

    it.each([
      {
        typed: 'Please share a sample chapter.',
        sent: 'Please share a sample chapter.',
      },
      { typed: '', sent: null },
    ])(
      'rejects with the reason %j sent as %j and refreshes the list',
      async ({ typed, sent }) => {
        const { user, invalidate } = await openRejectDialog();
        mutations.reject.mutate.mockImplementation(
          (_variables, options) => options.onSuccess(),
        );
        if (typed) {
          await user.type(
            screen.getByLabelText('Reason (optional)'),
            typed,
          );
        }

        await user.click(
          screen.getByRole('button', { name: 'Reject request' }),
        );

        expect(
          mutations.reject.mutate,
        ).toHaveBeenCalledExactlyOnceWith(
          { id: mina.id, reason: sent },
          expect.any(Object),
        );
        expect(showSuccess).toHaveBeenCalledOnce();
        expect(invalidate).toHaveBeenCalledWith({
          queryKey: ['AdminWriterRequestsInfinite'],
        });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      },
    );

    it('keeps the dialog open and shows the refusal of the server', async () => {
      const { user } = await openRejectDialog();
      mutations.reject.mutate.mockImplementation(
        (_variables, options) =>
          options.onError(
            new GraphqlRequestError(
              'This writer request was already reviewed',
              { code: 'BAD_REQUEST' },
            ),
          ),
      );

      await user.click(
        screen.getByRole('button', { name: 'Reject request' }),
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'already reviewed',
      );
      expect(screen.getByRole('dialog')).toBeVisible();
    });

    it('uses the generic error for any other failure', async () => {
      const { user } = await openRejectDialog();
      mutations.reject.mutate.mockImplementation(
        (_variables, options) =>
          options.onError(new TypeError('Failed to fetch')),
      );

      await user.click(
        screen.getByRole('button', { name: 'Reject request' }),
      );

      expect(showApiError).toHaveBeenCalledOnce();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('closes from Cancel without rejecting', async () => {
      const { user } = await openRejectDialog();

      await user.click(
        screen.getByRole('button', { name: 'Cancel' }),
      );

      expect(mutations.reject.mutate).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
