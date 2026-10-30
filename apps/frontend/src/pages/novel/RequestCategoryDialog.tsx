import { useState } from 'react';

import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { useRequestCategoryMutation } from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';

interface RequestCategoryDialogProps {
  initialName: string;
  onRequested: () => void;
  onClose: () => void;
}

/**
 * @description The server answers a refused request (the name exists, is empty or too long) with a 400 whose message is meant for the writer, so it is shown here instead of the generic error toast.
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

export function RequestCategoryDialog({
  initialName,
  onRequested,
  onClose,
}: RequestCategoryDialogProps) {
  const [name, setName] = useState(initialName);
  const [refusal, setRefusal] = useState<string | null>(null);
  const requestCategory = useRequestCategoryMutation();
  const canSubmit =
    name.trim().length > 0 && !requestCategory.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    setRefusal(null);
    requestCategory.mutate(
      { name: name.trim() },
      {
        onSuccess: ({ requestCategory: requested }) => {
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
    <Dialog title="Request a category" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <p className="text-sm text-gray-300">
          The new category will be created and be available after an
          admin approves it. Please come back later and add this
          category to your novel.
        </p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-300">
            Category name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={requestCategory.isPending}
            aria-invalid={refusal !== null}
            aria-describedby={
              refusal ? 'request-category-error' : undefined
            }
            className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
          />
        </label>
        {refusal && (
          <p
            id="request-category-error"
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
            disabled={requestCategory.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="solid"
            color="blue"
            disabled={!canSubmit}
          >
            Request category
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
