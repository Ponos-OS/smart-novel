import { Role } from '@smart-novel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ToggleGroup } from 'radix-ui';
import { useState } from 'react';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import { WriterRequestStatus } from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { RejectWriterRequestDialog } from './RejectWriterRequestDialog';
import {
  ADMIN_WRITER_REQUESTS_KEY,
  useAdminWriterRequests,
} from './use-admin-writer-requests';
import {
  type AdminWriterRequest,
  WriterRequestRow,
} from './WriterRequestRow';

const STATUS_FILTERS: {
  value: WriterRequestStatus;
  label: string;
}[] = [
  { value: WriterRequestStatus.Pending, label: 'Pending' },
  { value: WriterRequestStatus.Approved, label: 'Approved' },
  { value: WriterRequestStatus.Rejected, label: 'Rejected' },
];

export function AdminWriterRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.roles.includes(Role.admin);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(WriterRequestStatus.Pending);
  const [rejecting, setRejecting] =
    useState<AdminWriterRequest | null>(null);
  const requests = useAdminWriterRequests(status, isAdmin);
  const statusLabel =
    STATUS_FILTERS.find(({ value }) => value === status)?.label ?? '';

  if (authLoading) {
    return <LoadingSpinner label="Loading writer requests..." />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-400">
        <p>You don't have permission to review writer requests.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-white">
        Writer requests
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        Approving a request makes the user a writer. They get the role
        the next time they sign in.
      </p>

      <div className="mb-4 flex justify-end">
        <ToggleGroup.Root
          type="single"
          value={status}
          // Pressing the selected item again would leave nothing selected.
          onValueChange={(value) => {
            if (value) {
              setStatus(value as WriterRequestStatus);
            }
          }}
          aria-label="Filter by status"
          className="flex gap-2"
        >
          {STATUS_FILTERS.map(({ value, label }) => (
            <ToggleGroup.Item
              key={value}
              value={value}
              className="cursor-pointer rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-300 outline-none transition-colors hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500 data-[state=on]:border-blue-500 data-[state=on]:bg-blue-900 data-[state=on]:text-blue-100"
            >
              {label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800">
        <table className="w-full text-left">
          <thead className="text-xs text-gray-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Requester
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Note
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Requested
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.requests.map((request) => (
              <WriterRequestRow
                key={request.id}
                request={request}
                onReject={setRejecting}
              />
            ))}
          </tbody>
        </table>
        {requests.isLoading && (
          <p
            role="status"
            className="px-4 py-6 text-center text-gray-400"
          >
            Loading writer requests...
          </p>
        )}
        {requests.isError && (
          <p
            role="alert"
            className="px-4 py-6 text-center text-red-400"
          >
            Failed to fetch the writer requests
          </p>
        )}
        {!requests.isLoading &&
          !requests.isError &&
          requests.requests.length === 0 && (
            <p className="px-4 py-6 text-center text-gray-400">
              No {statusLabel.toLowerCase()} requests.
            </p>
          )}
      </div>

      {requests.hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={requests.isLoadingMore}
            onClick={() => requests.loadMore()}
            className="cursor-pointer rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {requests.isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {rejecting && (
        <RejectWriterRequestDialog
          request={rejecting}
          onRejected={() => {
            setRejecting(null);
            queryClient.invalidateQueries({
              queryKey: [ADMIN_WRITER_REQUESTS_KEY],
            });
          }}
          onClose={() => setRejecting(null)}
        />
      )}
    </div>
  );
}
