import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

import { Button } from '../../components/Button';
import { Tooltip } from '../../components/Tooltip';
import {
  type AdminCategoriesQuery,
  CategoryStatus,
  useApproveCategoryMutation,
  useUpdateCategoryMutation,
} from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError } from '../../utils/notification';
import { ADMIN_CATEGORIES_KEY } from './use-admin-categories';

export type AdminCategory =
  AdminCategoriesQuery['categoriesConnection']['edges'][number]['node'];

interface CategoryRowProps {
  category: AdminCategory;
  onDelete: (category: AdminCategory) => void;
}

const ICON_BUTTON_CLASSES =
  'cursor-pointer rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50';

const STATUS_CLASSES: Record<CategoryStatus, string> = {
  [CategoryStatus.Approved]: 'bg-green-900 text-green-200',
  [CategoryStatus.Pending]: 'bg-yellow-900 text-yellow-200',
};

export function CategoryRow({
  category,
  onDelete,
}: CategoryRowProps) {
  const queryClient = useQueryClient();
  const approve = useApproveCategoryMutation();
  const rename = useUpdateCategoryMutation();
  const [draft, setDraft] = useState<string | null>(null);
  const [renameRefusal, setRenameRefusal] = useState<string | null>(
    null,
  );
  const isEditing = draft !== null;
  const isBusy = approve.isPending || rename.isPending;

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: [ADMIN_CATEGORIES_KEY],
    });

  const stopEditing = () => {
    setDraft(null);
    setRenameRefusal(null);
  };

  const saveName = () => {
    const name = draft?.trim();

    if (!name || rename.isPending) {
      return;
    }

    if (name.toLowerCase() === category.name) {
      stopEditing();
      return;
    }

    setRenameRefusal(null);
    rename.mutate(
      { id: category.id, name },
      {
        onSuccess: () => {
          stopEditing();
          refresh();
        },
        onError: (error) => {
          // A 400 is a refusal written for the admin (the name exists, is empty or too long).
          if (
            error instanceof GraphqlRequestError &&
            error.extensions?.code === 'BAD_REQUEST'
          ) {
            setRenameRefusal(error.message);
            return;
          }

          showApiError();
        },
      },
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      stopEditing();
    }
  };

  const handleApprove = () => {
    approve.mutate(
      { id: category.id },
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
              saveName();
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                autoFocus
                aria-label={`New name of ${category.name}`}
                aria-invalid={renameRefusal !== null}
                value={draft}
                disabled={rename.isPending}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              />
              <Button
                type="submit"
                variant="solid"
                color="blue"
                disabled={!draft.trim() || rename.isPending}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                color="gray"
                onClick={stopEditing}
                disabled={rename.isPending}
              >
                Cancel
              </Button>
            </div>
            {renameRefusal && (
              <p role="alert" className="text-sm text-red-300">
                {renameRefusal}
              </p>
            )}
          </form>
        ) : (
          <span className="font-medium text-white">
            {category.name}
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_CLASSES[category.status]}`}
        >
          {category.status === CategoryStatus.Approved
            ? 'Approved'
            : 'Pending'}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-sm text-gray-400">
        {category.requesterUserId ? (
          <code title={category.requesterUserId} className="text-xs">
            {category.requesterUserId}
          </code>
        ) : (
          '-'
        )}
      </td>
      <td className="px-4 py-3 text-right align-top text-sm text-gray-300">
        <Tooltip content="An estimate, not an exact count">
          <span tabIndex={0} className="cursor-help">
            ~{category.approximateNovelCount.toLocaleString('en-US')}
          </span>
        </Tooltip>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-1">
          {category.status === CategoryStatus.Pending && (
            <Button
              variant="chip"
              color="green"
              disabled={isBusy}
              aria-label={`Approve ${category.name}`}
              onClick={handleApprove}
            >
              Approve
            </Button>
          )}
          <Tooltip content="Edit category">
            <button
              type="button"
              aria-label={`Edit category ${category.name}`}
              disabled={isBusy || isEditing}
              onClick={() => setDraft(category.name)}
              className={`${ICON_BUTTON_CLASSES} hover:text-blue-300`}
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="Delete category">
            <button
              type="button"
              aria-label={`Delete category ${category.name}`}
              disabled={isBusy}
              onClick={() => onDelete(category)}
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
