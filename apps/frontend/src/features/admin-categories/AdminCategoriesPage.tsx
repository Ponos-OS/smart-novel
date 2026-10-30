import { Role } from '@smart-novel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ToggleGroup } from 'radix-ui';
import { useState } from 'react';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  CategoryStatus,
  useDeleteCategoryMutation,
} from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { showApiError, showSuccess } from '../../utils/notification';
import { type AdminCategory, CategoryRow } from './CategoryRow';
import {
  ADMIN_CATEGORIES_KEY,
  useAdminCategories,
} from './use-admin-categories';

type StatusFilter = 'all' | 'approved' | 'pending';

const STATUS_FILTERS: {
  value: StatusFilter;
  label: string;
  statuses: CategoryStatus[];
}[] = [
  {
    value: 'all',
    label: 'All',
    statuses: [CategoryStatus.Approved, CategoryStatus.Pending],
  },
  {
    value: 'approved',
    label: 'Approved',
    statuses: [CategoryStatus.Approved],
  },
  {
    value: 'pending',
    label: 'Pending',
    statuses: [CategoryStatus.Pending],
  },
];

const SEARCH_DEBOUNCE_MS = 300;

function describeDeletion(category: AdminCategory): string {
  if (category.status === CategoryStatus.Pending) {
    return `The request for "${category.name}" will be rejected and removed.`;
  }

  return `"${category.name}" will be removed from about ${category.approximateNovelCount.toLocaleString('en-US')} novels. The novels themselves stay.`;
}

export function AdminCategoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.roles.includes(Role.admin);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all');
  const [deleting, setDeleting] = useState<AdminCategory | null>(
    null,
  );
  const deleteCategory = useDeleteCategoryMutation();
  const debouncedSearch = useDebouncedValue(
    search.trim(),
    SEARCH_DEBOUNCE_MS,
  );
  const statuses =
    STATUS_FILTERS.find(({ value }) => value === statusFilter)
      ?.statuses ?? [];
  const categories = useAdminCategories(
    debouncedSearch,
    statuses,
    isAdmin,
  );

  const handleConfirmDelete = () => {
    if (!deleting) {
      return;
    }

    deleteCategory.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          showSuccess(`"${deleting.name}" was deleted.`);
          setDeleting(null);
          queryClient.invalidateQueries({
            queryKey: [ADMIN_CATEGORIES_KEY],
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
    return <LoadingSpinner label="Loading categories..." />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-400">
        <p>You don't have permission to manage categories.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-white">
        Categories
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        Writers can only use approved categories. Approve the requests
        of the writers, rename a category, or delete one; deleting
        removes it from every novel that has it.
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          aria-label="Search categories"
          placeholder="Search categories"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white"
        />
        <ToggleGroup.Root
          type="single"
          value={statusFilter}
          // Pressing the selected item again would leave nothing selected.
          onValueChange={(value) => {
            if (value) {
              setStatusFilter(value as StatusFilter);
            }
          }}
          aria-label="Filter by status"
          className="flex gap-2"
        >
          {STATUS_FILTERS.map(({ value, label }) => (
            <ToggleGroup.Item
              key={value}
              value={value}
              className="cursor-pointer rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-300 outline-none transition-colors hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-blue-500 data-[state=on]:border-blue-500 data-[state=on]:bg-blue-900 data-[state=on]:text-blue-100"
            >
              {label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
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
            {categories.categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onDelete={setDeleting}
              />
            ))}
          </tbody>
        </table>
        {categories.isLoading && (
          <p
            role="status"
            className="px-4 py-6 text-center text-gray-400"
          >
            Loading categories...
          </p>
        )}
        {categories.isError && (
          <p
            role="alert"
            className="px-4 py-6 text-center text-red-400"
          >
            Failed to fetch the categories
          </p>
        )}
        {!categories.isLoading &&
          !categories.isError &&
          categories.categories.length === 0 && (
            <p className="px-4 py-6 text-center text-gray-400">
              No category matches.
            </p>
          )}
      </div>

      {categories.hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={categories.isLoadingMore}
            onClick={() => categories.loadMore()}
            className="cursor-pointer rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {categories.isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title={
            deleting.status === CategoryStatus.Pending
              ? 'Reject the request'
              : 'Delete the category'
          }
          message={describeDeletion(deleting)}
          confirmLabel={
            deleting.status === CategoryStatus.Pending
              ? 'Reject'
              : 'Delete'
          }
          loadingLabel="Deleting..."
          isLoading={deleteCategory.isPending}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
