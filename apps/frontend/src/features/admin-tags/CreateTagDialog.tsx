import { TAG_DESCRIPTION_MAX_LENGTH } from '@smart-novel/shared';
import { useState } from 'react';

import { Dialog } from '../../components/Dialog';
import { DialogFormFooter } from '../../components/DialogFormFooter';
import { useCreateTagMutation } from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';

interface CreateTagDialogProps {
  onCreated: () => void;
  onClose: () => void;
}

function getRefusalMessage(error: unknown): string | null {
  if (
    error instanceof GraphqlRequestError &&
    error.extensions?.code === 'BAD_REQUEST'
  ) {
    return error.message;
  }

  return null;
}

export function CreateTagDialog({
  onCreated,
  onClose,
}: CreateTagDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const createTag = useCreateTagMutation();
  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    !createTag.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    setRefusal(null);
    createTag.mutate(
      {
        input: { name: name.trim(), description: description.trim() },
      },
      {
        onSuccess: ({ createTag: created }) => {
          showSuccess(`"${created.name}" was created.`);
          onCreated();
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
    <Dialog title="Create a tag" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <p className="text-sm text-gray-300">
          The tag is approved right away, so writers can add it to
          their novels.
        </p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-300">
            Tag name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={createTag.isPending}
            aria-invalid={refusal !== null}
            aria-describedby={
              refusal ? 'create-tag-error' : undefined
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
            disabled={createTag.isPending}
            aria-invalid={refusal !== null}
            aria-describedby={
              refusal ? 'create-tag-error' : undefined
            }
            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
          />
        </label>
        <p className="text-xs text-gray-400">
          What the tag is for. {description.length}/
          {TAG_DESCRIPTION_MAX_LENGTH}
        </p>
        <DialogFormFooter
          refusal={refusal}
          refusalId="create-tag-error"
          isPending={createTag.isPending}
          submitLabel="Create tag"
          submitDisabled={!canSubmit}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
