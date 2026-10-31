import { Button } from '../../components/Button';
import { WriterRequestStatus } from '../../generated/graphql';

export interface WriterAccessRequest {
  status: WriterRequestStatus;
  rejectionReason?: string | null;
}

interface WriterAccessCardProps {
  /** @description The latest request of the user, null when they never asked. */
  request: WriterAccessRequest | null;
  onRequest: () => void;
}

export function WriterAccessCard({
  request,
  onRequest,
}: WriterAccessCardProps) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-sm sm:p-6">
      <WriterAccessBody request={request} onRequest={onRequest} />
    </div>
  );
}

function WriterAccessBody({
  request,
  onRequest,
}: WriterAccessCardProps) {
  if (request?.status === WriterRequestStatus.Pending) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-yellow-900 px-3 py-1 text-xs font-medium text-yellow-200">
          Request pending
        </span>
        <p className="text-sm text-gray-400">
          An admin will review it. You will see the answer here.
        </p>
      </div>
    );
  }

  if (request?.status === WriterRequestStatus.Approved) {
    return (
      <p className="text-sm text-green-300">
        Your request was approved. Sign out and sign in again to start
        writing.
      </p>
    );
  }

  const wasRejected =
    request?.status === WriterRequestStatus.Rejected;

  return (
    <div className="sm:flex sm:items-start sm:justify-between">
      <div className="mb-4 sm:mb-0 sm:mr-6">
        <h3 className="text-base font-medium text-white">
          {wasRejected
            ? 'Your request was not approved'
            : 'Become a writer'}
        </h3>
        {wasRejected && request.rejectionReason && (
          <p className="mt-1 text-sm text-gray-300">
            {request.rejectionReason}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-400">
          {wasRejected
            ? 'You can send a new request.'
            : 'Ask the admins for permission to publish your own novels.'}
        </p>
      </div>
      <Button
        type="button"
        variant="solid"
        color="blue"
        onClick={onRequest}
      >
        {wasRejected ? 'Request again' : 'Become a writer'}
      </Button>
    </div>
  );
}
