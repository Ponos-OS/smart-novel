import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

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
}

type Mode = 'idle' | 'editing' | 'previewing';

export function ChapterContentEditor({
  chapter,
  canEdit,
  canManageTts,
}: ChapterContentEditorProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('idle');
  const [title, setTitle] = useState(chapter.title ?? '');
  const [content, setContent] = useState(chapter.content);

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

  const titleChanged = title !== (chapter.title ?? '');
  const contentChanged = content !== chapter.content;
  const canSave =
    !isSaving &&
    title.trim().length > 0 &&
    (titleChanged || contentChanged);

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

  const startEdit = () => {
    setTitle(chapter.title ?? '');
    setContent(chapter.content);
    setMode('editing');
  };

  const cancelEdit = () => {
    setTitle(chapter.title ?? '');
    setContent(chapter.content);
    setMode('idle');
  };

  const handleSaved = (
    patch: Partial<Pick<Chapter, 'title' | 'content'>>,
  ) => {
    patchCache({ ...patch, updatedAt: new Date().toISOString() });
    showSuccess('Chapter updated.');
    setMode('idle');
  };

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
          onError: showApiError,
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
          onError: showApiError,
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
        onError: showApiError,
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
            disabled={isSaving}
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
                  disabled={isSaving}
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
                  onClick={cancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="chip" color="blue" onClick={startEdit}>
                Edit
              </Button>
            ))}
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
              disabled={isSaving}
              rows={20}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          )
        ) : (
          <MarkdownRenderer content={chapter.content} />
        )}
      </div>
    </>
  );
}
