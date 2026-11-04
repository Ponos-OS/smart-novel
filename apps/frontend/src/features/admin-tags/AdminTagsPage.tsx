import { Role } from '@smart-novel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusToggleGroup } from '../../components/StatusToggleGroup';
import {
  TagStatus,
  useDeleteTagMutation,
} from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { showApiError, showSuccess } from '../../utils/notification';
import { CreateTagDialog } from './CreateTagDialog';
import { type AdminTag, TagRow } from './TagRow';
import { ADMIN_TAGS_KEY, useAdminTags } from './use-admin-tags';

type StatusFilter = 'all' | 'approved' | 'pending';

const STATUS_FILTERS: {
  value: StatusFilter;
  label: string;
  statuses: TagStatus[];
}[] = [
  {
    value: 'all',
    label: 'All',
    statuses: [TagStatus.Approved, TagStatus.Pending],
  },
  {
    value: 'approved',
    label: 'Approved',
    statuses: [TagStatus.Approved],
  },
  {
    value: 'pending',
    label: 'Pending',
    statuses: [TagStatus.Pending],
  },
];

const SEARCH_DEBOUNCE_MS = 300;

function describeDeletion(tag: AdminTag): string {
  if (tag.status === TagStatus.Pending) {
    return `The request for "${tag.name}" will be rejected and removed.`;
  }

  return `"${tag.name}" will be removed from about ${tag.approximateNovelCount.toLocaleString('en-US')} novels. The novels themselves stay.`;
}

export function AdminTagsPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.roles.includes(Role.admin);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all');
  const [deleting, setDeleting] = useState<AdminTag | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const deleteTag = useDeleteTagMutation();
  const debouncedSearch = useDebouncedValue(
    search.trim(),
    SEARCH_DEBOUNCE_MS,
  );
  const statuses =
    STATUS_FILTERS.find(({ value }) => value === statusFilter)
      ?.statuses ?? [];
  const tags = useAdminTags(debouncedSearch, statuses, isAdmin);

  const handleConfirmDelete = () => {
    if (!deleting) {
      return;
    }

    deleteTag.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          showSuccess(`"${deleting.name}" was deleted.`);
          setDeleting(null);
          queryClient.invalidateQueries({
            queryKey: [ADMIN_TAGS_KEY],
          });
        },
        onError: () => {
          setDeleting(null);
          showApiError();
        },
      },
    );
  };

  if (authLoading) {
    return <LoadingSpinner label="Loading tags..." />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-400">
        <p>You don't have permission to manage tags.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-white">Tags</h1>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          Create tag
        </button>
      </div>
      <p className="mb-6 text-sm text-gray-400">
        Writers can only use approved tags. Approve the requests of
        the writers, rename a tag, or delete one; deleting removes it
        from every novel that has it.
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          aria-label="Search tags"
          placeholder="Search tags"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
        />
        <StatusToggleGroup
          value={statusFilter}
          options={STATUS_FILTERS}
          onChange={setStatusFilter}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800">
        <table className="w-full text-left">
          <thead className="text-xs text-gray-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Name
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Requested by
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-medium"
              >
                Novels
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tags.tags.map((tag) => (
              <TagRow key={tag.id} tag={tag} onDelete={setDeleting} />
            ))}
          </tbody>
        </table>
        {tags.isLoading && (
          <p
            role="status"
            className="px-4 py-6 text-center text-gray-400"
          >
            Loading tags...
          </p>
        )}
        {tags.isError && (
          <p
            role="alert"
            className="px-4 py-6 text-center text-red-400"
          >
            Failed to fetch the tags
          </p>
        )}
        {!tags.isLoading &&
          !tags.isError &&
          tags.tags.length === 0 && (
            <p className="px-4 py-6 text-center text-gray-400">
              No tag matches.
            </p>
          )}
      </div>

      {tags.hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={tags.isLoadingMore}
            onClick={() => tags.loadMore()}
            className="cursor-pointer rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tags.isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {isCreating && (
        <CreateTagDialog
          onCreated={() => {
            setIsCreating(false);
            queryClient.invalidateQueries({
              queryKey: [ADMIN_TAGS_KEY],
            });
          }}
          onClose={() => setIsCreating(false)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={
            deleting.status === TagStatus.Pending
              ? 'Reject the request'
              : 'Delete the tag'
          }
          message={describeDeletion(deleting)}
          confirmLabel={
            deleting.status === TagStatus.Pending
              ? 'Reject'
              : 'Delete'
          }
          loadingLabel="Deleting..."
          isLoading={deleteTag.isPending}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
