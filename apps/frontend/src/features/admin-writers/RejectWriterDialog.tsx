import { WRITER_NOTE_MAX_LENGTH } from '@smart-novel/shared';
import { useState } from 'react';

import { Dialog } from '../../components/Dialog';
import { DialogFormFooter } from '../../components/DialogFormFooter';
import { useRejectWriterMutation } from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { type AdminWriter } from './WriterRow';

interface RejectWriterDialogProps {
  request: AdminWriter;
  onRejected: () => void;
  onClose: () => void;
}

export function RejectWriterDialog({
  request,
  onRejected,
  onClose,
}: RejectWriterDialogProps) {
  const [reason, setReason] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const reject = useRejectWriterMutation();

  const handleSubmit = () => {
    if (reject.isPending) {
      return;
    }

    setRefusal(null);
    reject.mutate(
      { id: request.id, reason: reason.trim() || null },
      {
        onSuccess: () => {
          showSuccess(`The request of ${request.name} was rejected.`);
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
          {request.name} will see your reason and can send a new
          request.
        </p>
        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-300">
              Reason (optional)
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={WRITER_NOTE_MAX_LENGTH}
              rows={4}
              disabled={reject.isPending}
              aria-invalid={refusal !== null}
              aria-describedby={
                refusal ? 'reject-writer-error' : undefined
              }
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
            />
          </label>
          <span className="mt-1 block text-right text-xs text-gray-400">
            {reason.length} / {WRITER_NOTE_MAX_LENGTH}
          </span>
        </div>
        <DialogFormFooter
          refusal={refusal}
          refusalId="reject-writer-error"
          isPending={reject.isPending}
          submitLabel="Reject request"
          submitColor="red"
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
