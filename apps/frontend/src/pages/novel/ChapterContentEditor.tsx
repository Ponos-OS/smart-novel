import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';

import { Button } from '../../components/Button';
import { GenerateTtsButton } from '../../components/GenerateTtsButton';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';
import {
  Chapter,
  GetChapterQuery,
  useGetChapterQuery,
  useUpdateChapterAndContentMutation,
  useUpdateChapterMutation,
  useUpdateContentMutation,
} from '../../generated/graphql';
import { isConflictError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';

type ChapterContentEditorData = Pick<
  Chapter,
  | 'id'
  | 'novelId'
  | 'title'
  | 'content'
  | 'updatedAt'
  | 'contentUpdatedAt'
  | 'narrationStatus'
  | 'narrationUrl'
>;

interface ChapterContentEditorProps {
  chapter: ChapterContentEditorData;
  canEdit: boolean;
  canManageTts?: boolean;
  /** Start directly in edit mode, e.g. when rendered on a dedicated edit route. */
  startInEditMode?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
  /** Navigate to the dedicated edit route instead of editing inline — there is no inline edit mode. */
  onEditClick?: () => void;
}

type Mode = 'idle' | 'editing' | 'previewing';

export function ChapterContentEditor({
  chapter,
  canEdit,
  canManageTts,
  startInEditMode,
  onCancel,
  onSaved,
  onEditClick,
}: ChapterContentEditorProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(
    startInEditMode ? 'editing' : 'idle',
  );
  const [title, setTitle] = useState(chapter.title ?? '');
  const [content, setContent] = useState(chapter.content);
  const [hasConflict, setHasConflict] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  /** The chapter version that conflicted, captured so we can tell the refetch triggered by "Reload latest" apart from the stale data still sitting in `chapter` right after it's kicked off. */
  const [conflictBaseline, setConflictBaseline] = useState<{
    updatedAt: string;
    contentUpdatedAt: string;
  } | null>(null);
  /** Set on a successful save; read/written only inside effects/handlers (never during render). `onSaved` (which navigates away) fires from an effect once `setMode('idle')` has actually committed, so the blocker below sees `isEditing: false` before the navigation happens instead of racing it. */
  const pendingOnSavedRef = useRef(false);

  const updateContentMutation = useUpdateContentMutation();
  const updateChapterMutation = useUpdateChapterMutation();
  const updateChapterAndContentMutation =
    useUpdateChapterAndContentMutation();

  const isEditing = mode !== 'idle';
  const isPreviewing = mode === 'previewing';
  const isSaving =
    updateContentMutation.isPending ||
    updateChapterMutation.isPending ||
    updateChapterAndContentMutation.isPending;
  const isBusy = isSaving || isReloading;

  const titleChanged = title !== (chapter.title ?? '');
  const contentChanged = content !== chapter.content;
  const isDirty = titleChanged || contentChanged;
  const canSave =
    !isSaving &&
    !hasConflict &&
    !isReloading &&
    title.trim().length > 0 &&
    isDirty;

  /**
   * @description Guards every attempt to navigate away while editing with unsaved changes —
   * clicking Cancel, a breadcrumb link, or the browser back button all go through the router
   * and get caught here uniformly, instead of only the Cancel button having its own check.
   */
  const blocker = useBlocker(isEditing && isDirty);

  useEffect(() => {
    if (!isEditing || !isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome requires returnValue to be set for the native prompt to show.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () =>
      window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditing, isDirty]);

  /**
   * @description Runs only after `setMode('idle')` from a successful save has actually
   * committed (so `isEditing` is already `false` and the blocker above has re-registered
   * accordingly) before calling `onSaved`, which navigates away — calling it synchronously
   * inside `handleSaved` would race the state update and get caught by our own blocker.
   */
  useEffect(() => {
    if (pendingOnSavedRef.current) {
      pendingOnSavedRef.current = false;
      onSaved?.();
    }
  }, [mode, onSaved]);

  const patchCache = (
    patch: Partial<Pick<Chapter, 'title' | 'content' | 'updatedAt'>>,
  ) => {
    const queryKey = useGetChapterQuery.getKey({
      novelId: chapter.novelId,
      chapterId: chapter.id,
    });

    queryClient.setQueryData<GetChapterQuery>(queryKey, (old) => {
      if (!old?.novel?.chapter) {
        return old;
      }

      return {
        ...old,
        novel: {
          ...old.novel,
          chapter: {
            ...old.novel.chapter,
            ...patch,
          },
        },
      };
    });
  };

  const handleSaved = (
    patch: Partial<Pick<Chapter, 'title' | 'content'>>,
  ) => {
    patchCache({ ...patch, updatedAt: new Date().toISOString() });
    showSuccess('Chapter updated.');
    pendingOnSavedRef.current = true;
    setMode('idle');
  };

  const handleSaveError = (error: unknown) => {
    if (isConflictError(error)) {
      setConflictBaseline({
        updatedAt: chapter.updatedAt,
        contentUpdatedAt: chapter.contentUpdatedAt,
      });
      setHasConflict(true);
      return;
    }
    showApiError();
  };

  const handleReloadLatest = () => {
    queryClient.invalidateQueries({
      queryKey: useGetChapterQuery.getKey({
        novelId: chapter.novelId,
        chapterId: chapter.id,
      }),
    });
    setHasConflict(false);
    setIsReloading(true);
  };

  /**
   * @description "Reload latest" kicks off a refetch but `chapter` is still the stale prop
   * until it resolves. Rather than syncing via an effect (an extra render after the data
   * lands), adjust state directly during render — React's endorsed pattern for resetting
   * state in response to a prop change — as soon as `chapter` actually differs from the
   * version that conflicted, so the writer stays on the edit view instead of being bounced
   * back to read mode.
   */
  if (
    isReloading &&
    conflictBaseline &&
    (chapter.updatedAt !== conflictBaseline.updatedAt ||
      chapter.contentUpdatedAt !== conflictBaseline.contentUpdatedAt)
  ) {
    setConflictBaseline(null);
    setIsReloading(false);
    setTitle(chapter.title ?? '');
    setContent(chapter.content);
  }

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    if (titleChanged && contentChanged) {
      updateChapterAndContentMutation.mutate(
        {
          id: chapter.id,
          content,
          expectedContentUpdatedAt: chapter.contentUpdatedAt,
          input: { title },
          expectedUpdatedAt: chapter.updatedAt,
        },
        {
          onSuccess: () => handleSaved({ title, content }),
          onError: handleSaveError,
        },
      );
      return;
    }

    if (contentChanged) {
      updateContentMutation.mutate(
        {
          id: chapter.id,
          content,
          expectedContentUpdatedAt: chapter.contentUpdatedAt,
        },
        {
          onSuccess: () => handleSaved({ content }),
          onError: handleSaveError,
        },
      );
      return;
    }

    updateChapterMutation.mutate(
      {
        id: chapter.id,
        input: { title },
        expectedUpdatedAt: chapter.updatedAt,
      },
      {
        onSuccess: () => handleSaved({ title }),
        onError: handleSaveError,
      },
    );
  };

  return (
    <>
      <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isBusy}
            placeholder="Chapter title"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-2xl font-bold text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        ) : (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {chapter.title || `Chapter ${chapter.id}`}
          </h2>
        )}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Updated: {new Date(chapter.updatedAt).toLocaleDateString()}
        </p>
      </div>

      {(canManageTts || canEdit) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
              />
            </svg>
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Writer Tools
            </span>
          </div>

          {canManageTts && (
            <GenerateTtsButton
              novelId={chapter.novelId}
              chapterId={chapter.id}
              narrationStatus={chapter.narrationStatus}
              narrationUrl={chapter.narrationUrl}
            />
          )}

          {canEdit &&
            (isEditing ? (
              <>
                <Button
                  variant="solid"
                  color="gray"
                  onClick={() =>
                    setMode(isPreviewing ? 'editing' : 'previewing')
                  }
                  disabled={isBusy}
                >
                  {isPreviewing ? 'Edit' : 'Preview'}
                </Button>
                <Button
                  variant="solid"
                  color="blue"
                  onClick={handleSave}
                  disabled={!canSave}
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  color="gray"
                  onClick={() => onCancel?.()}
                  disabled={isBusy}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="chip"
                color="blue"
                onClick={() => onEditClick?.()}
              >
                Edit
              </Button>
            ))}
        </div>
      )}

      {hasConflict && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="mb-3 text-sm text-red-800 dark:text-red-200">
            This chapter was updated by someone else. Reload to see
            the latest version.
          </p>
          <Button
            variant="solid"
            color="red"
            onClick={handleReloadLatest}
          >
            Reload latest
          </Button>
        </div>
      )}

      {isReloading && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          Reloading the latest version...
        </div>
      )}

      <div className="prose-container">
        {isEditing ? (
          isPreviewing ? (
            <MarkdownRenderer content={content} />
          ) : (
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={isBusy}
              rows={20}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          )
        ) : (
          <MarkdownRenderer content={chapter.content} />
        )}
      </div>

      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Discard unsaved changes?
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              You have unsaved title/content edits. Leaving now will
              discard them. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                color="gray"
                onClick={() => blocker.reset()}
              >
                Keep Editing
              </Button>
              <Button
                variant="solid"
                color="red"
                onClick={() => blocker.proceed()}
              >
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
