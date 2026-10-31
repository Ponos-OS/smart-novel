import { WRITER_REQUEST_NOTE_MAX_LENGTH } from '@smart-novel/shared';
import { useState } from 'react';

import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { useRejectWriterRequestMutation } from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { type AdminWriterRequest } from './WriterRequestRow';

interface RejectWriterRequestDialogProps {
  request: AdminWriterRequest;
  onRejected: () => void;
  onClose: () => void;
}

export function RejectWriterRequestDialog({
  request,
  onRejected,
  onClose,
}: RejectWriterRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const reject = useRejectWriterRequestMutation();

  const handleSubmit = () => {
    if (reject.isPending) {
      return;
    }

    setRefusal(null);
    reject.mutate(
      { id: request.id, reason: reason.trim() || null },
      {
        onSuccess: () => {
          showSuccess(
            `The request of ${request.requesterName} was rejected.`,
          );
          onRejected();
        },
        onError: (error) => {
          // A 400 is a refusal written for the admin (already reviewed, reason too long).
          if (
            error instanceof GraphqlRequestError &&
            error.extensions?.code === 'BAD_REQUEST'
          ) {
            setRefusal(error.message);
            return;
          }

          showApiError();
        },
      },
    );
  };

  return (
    <Dialog title="Reject the request" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <p className="text-sm text-gray-300">
          {request.requesterName} will see your reason and can send a
          new request.
        </p>
        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-300">
              Reason (optional)
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={WRITER_REQUEST_NOTE_MAX_LENGTH}
              rows={4}
              disabled={reject.isPending}
              aria-invalid={refusal !== null}
              aria-describedby={
                refusal ? 'reject-writer-request-error' : undefined
              }
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
            />
          </label>
          <span className="mt-1 block text-right text-xs text-gray-400">
            {reason.length} / {WRITER_REQUEST_NOTE_MAX_LENGTH}
          </span>
        </div>
        {refusal && (
          <p
            id="reject-writer-request-error"
            role="alert"
            className="text-sm text-red-300"
          >
            {refusal}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            color="gray"
            onClick={onClose}
            disabled={reject.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="solid"
            color="red"
            disabled={reject.isPending}
          >
            Reject request
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
