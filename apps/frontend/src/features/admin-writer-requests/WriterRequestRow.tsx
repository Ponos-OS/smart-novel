import { useQueryClient } from '@tanstack/react-query';

import { Button } from '../../components/Button';
import {
  type AdminWriterRequestsQuery,
  useApproveWriterRequestMutation,
  WriterRequestStatus,
} from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { ADMIN_WRITER_REQUESTS_KEY } from './use-admin-writer-requests';

export type AdminWriterRequest =
  AdminWriterRequestsQuery['writerRequestsConnection']['edges'][number]['node'];

interface WriterRequestRowProps {
  request: AdminWriterRequest;
  onReject: (request: AdminWriterRequest) => void;
}

const STATUS_CLASSES: Record<WriterRequestStatus, string> = {
  [WriterRequestStatus.Pending]: 'bg-yellow-900 text-yellow-200',
  [WriterRequestStatus.Approved]: 'bg-green-900 text-green-200',
  [WriterRequestStatus.Rejected]: 'bg-red-900 text-red-200',
};

const STATUS_LABELS: Record<WriterRequestStatus, string> = {
  [WriterRequestStatus.Pending]: 'Pending',
  [WriterRequestStatus.Approved]: 'Approved',
  [WriterRequestStatus.Rejected]: 'Rejected',
};

export function WriterRequestRow({
  request,
  onReject,
}: WriterRequestRowProps) {
  const queryClient = useQueryClient();
  const approve = useApproveWriterRequestMutation();
  const isPending = request.status === WriterRequestStatus.Pending;

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: [ADMIN_WRITER_REQUESTS_KEY],
    });

  const handleApprove = () => {
    approve.mutate(
      { id: request.id },
      {
        onSuccess: () => {
          showSuccess(
            `${request.requesterName} is a writer now. They get the role after they sign in again.`,
          );
          refresh();
        },
        onError: (error) => {
          // A 400 means somebody reviewed it in the meantime, so the row is stale.
          if (
            error instanceof GraphqlRequestError &&
            error.extensions?.code === 'BAD_REQUEST'
          ) {
            showApiError(error.message);
            refresh();
            return;
          }

          showApiError(
            `Could not approve ${request.requesterName}. The request stays pending, so you can try again.`,
          );
        },
      },
    );
  };

  return (
    <tr className="border-t border-gray-700">
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-white">
          {request.requesterName}
        </p>
        <p className="text-sm text-gray-400">
          {request.requesterEmail}
        </p>
      </td>
      <td className="max-w-md whitespace-pre-wrap break-words px-4 py-3 align-top text-sm text-gray-300">
        {request.note}
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-gray-400">
        {new Date(request.createdAt).toLocaleDateString('en-US')}
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_CLASSES[request.status]}`}
        >
          {STATUS_LABELS[request.status]}
        </span>
        {request.rejectionReason && (
          <p className="mt-2 text-sm text-gray-400">
            {request.rejectionReason}
          </p>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        {isPending && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="chip"
              color="green"
              disabled={approve.isPending}
              aria-label={`Approve ${request.requesterName}`}
              onClick={handleApprove}
            >
              Approve
            </Button>
            <Button
              variant="chip"
              color="red"
              disabled={approve.isPending}
              aria-label={`Reject ${request.requesterName}`}
              onClick={() => onReject(request)}
            >
              Reject
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
