import { TAG_DESCRIPTION_MAX_LENGTH } from '@smart-novel/shared';
import { useState } from 'react';

import { Dialog } from '../../components/Dialog';
import { DialogFormFooter } from '../../components/DialogFormFooter';
import { useRequestTagMutation } from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';

interface RequestTagDialogProps {
  initialName: string;
  onRequested: () => void;
  onClose: () => void;
}

/**
 * @description The server answers a refused request (the name exists, the name or the description is empty or too long) with a 400 whose message is meant for the writer, so it is shown here instead of the generic error toast.
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

export function RequestTagDialog({
  initialName,
  onRequested,
  onClose,
}: RequestTagDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const requestTag = useRequestTagMutation();
  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    !requestTag.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    setRefusal(null);
    requestTag.mutate(
      {
        input: { name: name.trim(), description: description.trim() },
      },
      {
        onSuccess: ({ requestTag: requested }) => {
          showSuccess(
            `"${requested.name}" was requested. Come back after an admin approved it to add it to your novel.`,
          );
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
    <Dialog title="Request a tag" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <p className="text-sm text-gray-300">
          The new tag will be created and be available after an admin
          approves it. Please come back later and add this tag to your
          novel.
        </p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-300">
            Tag name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={requestTag.isPending}
            aria-invalid={refusal !== null}
            aria-describedby={
              refusal ? 'request-tag-error' : undefined
            }
            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-300">
            Description
          </span>
          <textarea
            rows={3}
            maxLength={TAG_DESCRIPTION_MAX_LENGTH}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={requestTag.isPending}
            aria-invalid={refusal !== null}
            aria-describedby={
              refusal ? 'request-tag-error' : undefined
            }
            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
          />
        </label>
        <p className="text-xs text-gray-400">
          What the tag is for, so an admin and other writers know when
          to use it. {description.length}/{TAG_DESCRIPTION_MAX_LENGTH}
        </p>
        <DialogFormFooter
          refusal={refusal}
          refusalId="request-tag-error"
          isPending={requestTag.isPending}
          submitLabel="Request tag"
          submitDisabled={!canSubmit}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
