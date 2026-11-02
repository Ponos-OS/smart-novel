import {
  getPenNameProblem,
  PEN_NAME_PROBLEM_MESSAGES,
  WRITER_NOTE_MAX_LENGTH,
  WRITER_PEN_NAME_MAX_LENGTH,
} from '@smart-novel/shared';
import { useEffect, useState } from 'react';

import { Dialog } from '../../components/Dialog';
import { DialogFormFooter } from '../../components/DialogFormFooter';
import { useRequestWriterAccessMutation } from '../../generated/graphql';
import {
  GraphqlRequestError,
  isPenNameTakenError,
} from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';

interface RequestWriterAccessDialogProps {
  onRequested: () => void;
  onClose: () => void;
}

/** @description How long the pen name field stays red after the server said the name is taken. */
export const PEN_NAME_TAKEN_HIGHLIGHT_MS = 3000;

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
  const [penName, setPenName] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [takenAttempt, setTakenAttempt] = useState(0);
  const [isPenNameHighlighted, setIsPenNameHighlighted] =
    useState(false);
  const requestWriterAccess = useRequestWriterAccessMutation();
  const trimmedPenName = penName.trim();
  const penNameProblem =
    trimmedPenName.length > 0
      ? getPenNameProblem(trimmedPenName)
      : null;
  const canSubmit =
    note.trim().length > 0 &&
    trimmedPenName.length > 0 &&
    penNameProblem === null &&
    !requestWriterAccess.isPending;

  useEffect(() => {
    if (takenAttempt === 0) {
      return;
    }

    const timer = setTimeout(
      () => setIsPenNameHighlighted(false),
      PEN_NAME_TAKEN_HIGHLIGHT_MS,
    );

    return () => clearTimeout(timer);
  }, [takenAttempt]);

  const handlePenNameChange = (value: string) => {
    setPenName(value);
    setIsPenNameHighlighted(false);
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    setRefusal(null);
    requestWriterAccess.mutate(
      { note: note.trim(), penName: trimmedPenName },
      {
        onSuccess: () => {
          showSuccess('Your request was sent to the admins.');
          onRequested();
        },
        onError: (error) => {
          if (isPenNameTakenError(error)) {
            setIsPenNameHighlighted(true);
            setTakenAttempt((attempt) => attempt + 1);
            showApiError(
              `The pen name "${trimmedPenName}" is already taken. Please choose another one.`,
            );
            return;
          }

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
              Pen name
            </span>
            <input
              type="text"
              value={penName}
              onChange={(event) =>
                handlePenNameChange(event.target.value)
              }
              maxLength={WRITER_PEN_NAME_MAX_LENGTH}
              autoComplete="off"
              disabled={requestWriterAccess.isPending}
              aria-invalid={
                isPenNameHighlighted || penNameProblem !== null
              }
              aria-describedby="request-writer-access-pen-name-hint"
              className={`w-full rounded-lg border bg-gray-900 px-3 py-2 text-white transition-colors disabled:opacity-50 ${
                isPenNameHighlighted || penNameProblem !== null
                  ? 'border-red-500'
                  : 'border-gray-600'
              }`}
            />
          </label>
          <p
            id="request-writer-access-pen-name-hint"
            className={`mt-1 text-xs ${
              penNameProblem ? 'text-red-300' : 'text-gray-400'
            }`}
          >
            {penNameProblem
              ? PEN_NAME_PROBLEM_MESSAGES[penNameProblem]
              : 'The name readers see on your novels: English letters, hyphens and underscores, no numbers or spaces. It must be unique.'}
          </p>
        </div>
        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-300">
              Why do you want to write here?
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={WRITER_NOTE_MAX_LENGTH}
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
            {note.length} / {WRITER_NOTE_MAX_LENGTH}
          </span>
        </div>
        <DialogFormFooter
          refusal={refusal}
          refusalId="request-writer-access-error"
          isPending={requestWriterAccess.isPending}
          submitLabel="Send request"
          submitDisabled={!canSubmit}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
