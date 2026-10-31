import { WRITER_REQUEST_NOTE_MAX_LENGTH } from '@smart-novel/shared';
import { useState } from 'react';

import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { useRequestWriterAccessMutation } from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';

interface RequestWriterAccessDialogProps {
  onRequested: () => void;
  onClose: () => void;
}

/**
 * @description The server answers a refused request (a request is already pending, the note is empty or too long) with a 400 whose message is meant for the user, so it is shown here instead of the generic error toast.
 */
function getRefusalMessage(error: unknown): string | null {
  if (
    error instanceof GraphqlRequestError &&
    error.extensions?.code === 'BAD_REQUEST'
  ) {
    return error.message;
  }

  return null;
}

export function RequestWriterAccessDialog({
  onRequested,
  onClose,
}: RequestWriterAccessDialogProps) {
  const [note, setNote] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const requestWriterAccess = useRequestWriterAccessMutation();
  const canSubmit =
    note.trim().length > 0 && !requestWriterAccess.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    setRefusal(null);
    requestWriterAccess.mutate(
      { note: note.trim() },
      {
        onSuccess: () => {
          showSuccess('Your request was sent to the admins.');
          onRequested();
        },
        onError: (error) => {
          const message = getRefusalMessage(error);

          if (message) {
            setRefusal(message);
            return;
          }

          showApiError();
        },
      },
    );
  };

  return (
    <Dialog title="Become a writer" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <p className="text-sm text-gray-300">
          Tell the admins what you would like to write. They review
          every request, and you will see the answer in your settings.
        </p>
        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-300">
              Why do you want to write here?
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={WRITER_REQUEST_NOTE_MAX_LENGTH}
              rows={5}
              disabled={requestWriterAccess.isPending}
              aria-invalid={refusal !== null}
              aria-describedby={
                refusal ? 'request-writer-access-error' : undefined
              }
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
            />
          </label>
          <span className="mt-1 block text-right text-xs text-gray-400">
            {note.length} / {WRITER_REQUEST_NOTE_MAX_LENGTH}
          </span>
        </div>
        {refusal && (
          <p
            id="request-writer-access-error"
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
            disabled={requestWriterAccess.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="solid"
            color="blue"
            disabled={!canSubmit}
          >
            Send request
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
