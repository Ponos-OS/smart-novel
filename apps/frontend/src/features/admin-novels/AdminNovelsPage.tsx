import { Role } from '@smart-novel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  type NovelOrderByInput,
  NovelOrderField,
  NovelState,
  OrderDirection,
  useDeleteNovelMutation,
} from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { showApiError, showSuccess } from '../../utils/notification';
import { ContentStatsCards } from './ContentStatsCards';
import {
  buildNovelFilters,
  EMPTY_NOVEL_FILTERS,
  hasAnyFilter,
  type NovelFilterForm,
} from './novel-filters';
import { type AdminNovel, NovelRow } from './NovelRow';
import { ADMIN_NOVELS_KEY, useAdminNovels } from './use-admin-novels';
import { WriterPicker } from './WriterPicker';

type SortChoice = 'name' | 'oldest' | 'newest';

const SORT_ORDER: Record<SortChoice, NovelOrderByInput | undefined> =
  {
    name: undefined,
    oldest: {
      field: NovelOrderField.FirstChapterCreatedAt,
      direction: OrderDirection.Asc,
    },
    newest: {
      field: NovelOrderField.FirstChapterCreatedAt,
      direction: OrderDirection.Desc,
    },
  };

const ARIA_SORT = {
  name: 'none',
  oldest: 'ascending',
  newest: 'descending',
} as const;

const FIELD_CLASSES =
  'w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white';

function SortButton({
  label,
  isActive,
  onClick,
  children,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isActive}
      onClick={onClick}
      className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded transition-colors ${
        isActive
          ? 'bg-blue-900 text-blue-100'
          : 'text-gray-500 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

export function AdminNovelsPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.roles.includes(Role.admin);
  const queryClient = useQueryClient();
  const id = useId();
  const [form, setForm] = useState<NovelFilterForm>(
    EMPTY_NOVEL_FILTERS,
  );
  const [sort, setSort] = useState<SortChoice>('name');
  const [deleting, setDeleting] = useState<AdminNovel | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteNovel = useDeleteNovelMutation();
  const { filters, problems } = useMemo(
    () => buildNovelFilters(form),
    [form],
  );
  const novels = useAdminNovels(filters, SORT_ORDER[sort], isAdmin);

  const update = (changes: Partial<NovelFilterForm>) =>
    setForm((current) => ({ ...current, ...changes }));

  const toggleSort = (choice: 'oldest' | 'newest') =>
    setSort((current) => (current === choice ? 'name' : choice));

  const closeDeleteDialog = () => {
    setDeleting(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = () => {
    if (!deleting) {
      return;
    }

    setDeleteError(null);
    deleteNovel.mutate(
      { id: deleting.id },
      {
        onSuccess: () => {
          showSuccess(`"${deleting.name}" was deleted.`);
          closeDeleteDialog();
          queryClient.invalidateQueries({
            queryKey: [ADMIN_NOVELS_KEY],
          });
        },
        onError: () => {
          setDeleteError('Could not delete the novel. Try again.');
          showApiError();
        },
      },
    );
  };

  if (authLoading) {
    return <LoadingSpinner label="Loading novels..." />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-400">
        <p>You don't have permission to manage novels.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-white">Novels</h1>
      <p className="mb-6 text-sm text-gray-400">
        Every novel, whoever wrote it. The chapter count in the list
        is an estimate; the filter on it is exact. Deleting a novel
        removes it for good.
      </p>

      <ContentStatsCards />

      <fieldset className="mb-4 grid gap-4 rounded-lg border border-gray-700 bg-gray-800 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="px-2 text-sm font-medium text-gray-300">
          Filters
        </legend>

        <div className="sm:col-span-2 lg:col-span-4">
          <span className="mb-1 block text-xs font-medium text-gray-400">
            Writers
          </span>
          <WriterPicker
            value={form.writers}
            onChange={(writers) => update({ writers })}
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-state`}
            className="mb-1 block text-xs font-medium text-gray-400"
          >
            State
          </label>
          <select
            id={`${id}-state`}
            value={form.state}
            onChange={(event) =>
              update({
                state: event.target.value as NovelFilterForm['state'],
              })
            }
            className={FIELD_CLASSES}
          >
            <option value="">Any</option>
            <option value={NovelState.Ongoing}>Ongoing</option>
            <option value={NovelState.Finished}>Finished</option>
          </select>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-gray-400">
            Chapters
          </span>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              aria-label="Minimum chapters"
              placeholder="Min"
              value={form.minChapters}
              aria-invalid={!!problems.chapters}
              onChange={(event) =>
                update({ minChapters: event.target.value })
              }
              className={FIELD_CLASSES}
            />
            <input
              type="number"
              min={0}
              aria-label="Maximum chapters"
              placeholder="Max"
              value={form.maxChapters}
              aria-invalid={!!problems.chapters}
              onChange={(event) =>
                update({ maxChapters: event.target.value })
              }
              className={FIELD_CLASSES}
            />
          </div>
          {problems.chapters && (
            <p role="alert" className="mt-1 text-xs text-red-300">
              {problems.chapters}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-400">
            First chapter
          </span>
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="First chapter from"
              value={form.firstChapterFrom}
              aria-invalid={!!problems.dates}
              onChange={(event) =>
                update({ firstChapterFrom: event.target.value })
              }
              className={FIELD_CLASSES}
            />
            <input
              type="date"
              aria-label="First chapter to"
              value={form.firstChapterTo}
              aria-invalid={!!problems.dates}
              onChange={(event) =>
                update({ firstChapterTo: event.target.value })
              }
              className={FIELD_CLASSES}
            />
          </div>
          {problems.dates && (
            <p role="alert" className="mt-1 text-xs text-red-300">
              {problems.dates}
            </p>
          )}
        </div>

        <div className="flex items-end justify-end sm:col-span-2 lg:col-span-4">
          <Button
            variant="outline"
            color="gray"
            disabled={!hasAnyFilter(form)}
            onClick={() => setForm(EMPTY_NOVEL_FILTERS)}
          >
            Clear filters
          </Button>
        </div>
      </fieldset>

      <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800">
        <table className="w-full text-left">
          <thead className="text-xs text-gray-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Name
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Writer
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                State
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-medium"
              >
                Chapters
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                License
              </th>
              <th
                scope="col"
                aria-sort={ARIA_SORT[sort]}
                className="px-4 py-3 font-medium"
              >
                <span className="flex items-center gap-1">
                  First chapter
                  <span className="flex flex-col">
                    <SortButton
                      label="Sort by first chapter, oldest first"
                      isActive={sort === 'oldest'}
                      onClick={() => toggleSort('oldest')}
                    >
                      <ChevronUp
                        aria-hidden="true"
                        className="h-4 w-4"
                      />
                    </SortButton>
                    <SortButton
                      label="Sort by first chapter, newest first"
                      isActive={sort === 'newest'}
                      onClick={() => toggleSort('newest')}
                    >
                      <ChevronDown
                        aria-hidden="true"
                        className="h-4 w-4"
                      />
                    </SortButton>
                  </span>
                </span>
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {novels.novels.map((novel) => (
              <NovelRow
                key={novel.id}
                novel={novel}
                onDelete={setDeleting}
              />
            ))}
          </tbody>
        </table>
        {novels.isLoading && (
          <p
            role="status"
            className="px-4 py-6 text-center text-gray-400"
          >
            Loading novels...
          </p>
        )}
        {novels.isError && (
          <p
            role="alert"
            className="px-4 py-6 text-center text-red-400"
          >
            Failed to fetch the novels
          </p>
        )}
        {!novels.isLoading &&
          !novels.isError &&
          novels.novels.length === 0 && (
            <p className="px-4 py-6 text-center text-gray-400">
              No novel matches.
            </p>
          )}
      </div>

      {novels.hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={novels.isLoadingMore}
            onClick={() => novels.loadMore()}
            className="cursor-pointer rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {novels.isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete the novel"
          message={`"${deleting.name}" by ${deleting.writer?.penName ?? 'an unknown writer'} will be deleted for good, with its chapters, read history, narration audio and cover.`}
          confirmLabel="Delete"
          loadingLabel="Deleting..."
          isLoading={deleteNovel.isPending}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={closeDeleteDialog}
        />
      )}
    </div>
  );
}
