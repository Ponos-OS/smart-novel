import { useQueryClient } from '@tanstack/react-query';

import { Button } from '../../components/Button';
import {
  type AdminWritersQuery,
  useApproveWriterMutation,
  WriterStatus,
} from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { ADMIN_WRITERS_KEY } from './use-admin-writers';

export type AdminWriter =
  AdminWritersQuery['writersConnection']['edges'][number]['node'];

interface WriterRowProps {
  request: AdminWriter;
  onReject: (request: AdminWriter) => void;
}

const STATUS_CLASSES: Record<WriterStatus, string> = {
  [WriterStatus.Pending]: 'bg-yellow-900 text-yellow-200',
  [WriterStatus.Approved]: 'bg-green-900 text-green-200',
  [WriterStatus.Rejected]: 'bg-red-900 text-red-200',
};

const STATUS_LABELS: Record<WriterStatus, string> = {
  [WriterStatus.Pending]: 'Pending',
  [WriterStatus.Approved]: 'Approved',
  [WriterStatus.Rejected]: 'Rejected',
};

export function WriterRow({ request, onReject }: WriterRowProps) {
  const queryClient = useQueryClient();
  const approve = useApproveWriterMutation();
  const isPending = request.status === WriterStatus.Pending;
  const application = request.applications.at(-1);

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: [ADMIN_WRITERS_KEY],
    });

  const handleApprove = () => {
    approve.mutate(
      { id: request.id },
      {
        onSuccess: () => {
          showSuccess(
            `${request.name} is a writer now. They get the role after they sign in again.`,
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
            `Could not approve ${request.name}. The request stays pending, so you can try again.`,
          );
        },
      },
    );
  };

  return (
    <tr className="border-t border-gray-700">
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-white">{request.penName}</p>
        <p className="text-sm text-gray-300">{request.name}</p>
        <p className="text-sm text-gray-400">{request.email}</p>
      </td>
      <td className="max-w-md whitespace-pre-wrap break-words px-4 py-3 align-top text-sm text-gray-300">
        {application?.note}
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
        {application?.rejectionReason && (
          <p className="mt-2 text-sm text-gray-400">
            {application.rejectionReason}
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
              aria-label={`Approve ${request.name}`}
              onClick={handleApprove}
            >
              Approve
            </Button>
            <Button
              variant="chip"
              color="red"
              disabled={approve.isPending}
              aria-label={`Reject ${request.name}`}
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
