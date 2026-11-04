import { TAG_DESCRIPTION_MAX_LENGTH } from '@smart-novel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

import { Button } from '../../components/Button';
import { Tooltip } from '../../components/Tooltip';
import {
  type AdminTagsQuery,
  TagStatus,
  useApproveTagMutation,
  useUpdateTagMutation,
} from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError } from '../../utils/notification';
import { ADMIN_TAGS_KEY } from './use-admin-tags';

export type AdminTag =
  AdminTagsQuery['tagsConnection']['edges'][number]['node'];

interface TagRowProps {
  tag: AdminTag;
  onDelete: (tag: AdminTag) => void;
}

interface TagDraft {
  name: string;
  description: string;
}

const ICON_BUTTON_CLASSES =
  'cursor-pointer rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50';

const STATUS_CLASSES: Record<TagStatus, string> = {
  [TagStatus.Approved]: 'bg-green-900 text-green-200',
  [TagStatus.Pending]: 'bg-yellow-900 text-yellow-200',
};

export function TagRow({ tag, onDelete }: TagRowProps) {
  const queryClient = useQueryClient();
  const approve = useApproveTagMutation();
  const update = useUpdateTagMutation();
  const [draft, setDraft] = useState<TagDraft | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const isEditing = draft !== null;
  const isBusy = approve.isPending || update.isPending;

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: [ADMIN_TAGS_KEY],
    });

  const startEditing = () =>
    setDraft({ name: tag.name, description: tag.description });

  const stopEditing = () => {
    setDraft(null);
    setRefusal(null);
  };

  const save = () => {
    if (!draft || update.isPending) {
      return;
    }

    const name = draft.name.trim();
    const description = draft.description.trim();

    if (!name) {
      return;
    }

    const changes = {
      ...(name !== tag.name && { name }),
      ...(description !== tag.description && { description }),
    };

    if (Object.keys(changes).length === 0) {
      stopEditing();
      return;
    }

    setRefusal(null);
    update.mutate(
      { id: tag.id, input: changes },
      {
        onSuccess: () => {
          stopEditing();
          refresh();
        },
        onError: (error) => {
          // A 400 is a refusal written for the admin (the name exists, is empty or too long, the description is too long).
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

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      stopEditing();
    }
  };

  const handleApprove = () => {
    approve.mutate(
      { id: tag.id },
      { onSuccess: refresh, onError: () => showApiError() },
    );
  };

  return (
    <tr className="border-t border-gray-700">
      <td className="px-4 py-3 align-top">
        {isEditing ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <input
              type="text"
              autoFocus
              aria-label={`New name of ${tag.name}`}
              aria-invalid={refusal !== null}
              value={draft.name}
              disabled={update.isPending}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              onKeyDown={handleKeyDown}
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            />
            <textarea
              rows={3}
              maxLength={TAG_DESCRIPTION_MAX_LENGTH}
              aria-label={`Description of ${tag.name}`}
              aria-invalid={refusal !== null}
              value={draft.description}
              disabled={update.isPending}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  description: event.target.value,
                })
              }
              onKeyDown={handleKeyDown}
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            />
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="solid"
                color="blue"
                disabled={!draft.name.trim() || update.isPending}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                color="gray"
                onClick={stopEditing}
                disabled={update.isPending}
              >
                Cancel
              </Button>
              <span className="text-xs text-gray-400">
                {draft.description.length}/
                {TAG_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
            {refusal && (
              <p role="alert" className="text-sm text-red-300">
                {refusal}
              </p>
            )}
          </form>
        ) : (
          <>
            <span className="font-medium text-white">{tag.name}</span>
            {tag.description && (
              <p className="mt-1 max-w-prose text-sm text-gray-400">
                {tag.description}
              </p>
            )}
          </>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_CLASSES[tag.status]}`}
        >
          {tag.status === TagStatus.Approved ? 'Approved' : 'Pending'}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-sm text-gray-400">
        {tag.requesterUserId ? (
          <code title={tag.requesterUserId} className="text-xs">
            {tag.requesterUserId}
          </code>
        ) : (
          '-'
        )}
      </td>
      <td className="px-4 py-3 text-right align-top text-sm text-gray-300">
        <Tooltip content="An estimate, not an exact count">
          <span tabIndex={0} className="cursor-help">
            ~{tag.approximateNovelCount.toLocaleString('en-US')}
          </span>
        </Tooltip>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-1">
          {tag.status === TagStatus.Pending && (
            <Button
              variant="chip"
              color="green"
              disabled={isBusy}
              aria-label={`Approve ${tag.name}`}
              onClick={handleApprove}
            >
              Approve
            </Button>
          )}
          <Tooltip content="Edit tag">
            <button
              type="button"
              aria-label={`Edit tag ${tag.name}`}
              disabled={isBusy || isEditing}
              onClick={startEditing}
              className={`${ICON_BUTTON_CLASSES} hover:text-blue-300`}
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="Delete tag">
            <button
              type="button"
              aria-label={`Delete tag ${tag.name}`}
              disabled={isBusy}
              onClick={() => onDelete(tag)}
              className={`${ICON_BUTTON_CLASSES} hover:text-red-400`}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </td>
    </tr>
  );
}
