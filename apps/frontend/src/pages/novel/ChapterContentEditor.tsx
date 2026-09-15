import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

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
  'id' | 'novelId' | 'title' | 'content' | 'updatedAt'
>;

interface ChapterContentEditorProps {
  chapter: ChapterContentEditorData;
  canEdit: boolean;
}

type Mode = 'idle' | 'editing' | 'previewing';

export function ChapterContentEditor({
  chapter,
  canEdit,
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
        { id: chapter.id, content, input: { title } },
        {
          onSuccess: () => handleSaved({ title, content }),
          onError: showApiError,
        },
      );
      return;
    }

    if (contentChanged) {
      updateContentMutation.mutate(
        { id: chapter.id, content },
        {
          onSuccess: () => handleSaved({ content }),
          onError: showApiError,
        },
      );
      return;
    }

    updateChapterMutation.mutate(
      { id: chapter.id, input: { title } },
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

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() =>
                  setMode(isPreviewing ? 'editing' : 'previewing')
                }
                disabled={isSaving}
                className="cursor-pointer rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                {isPreviewing ? 'Edit' : 'Preview'}
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                disabled={isSaving}
                className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="cursor-pointer rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/30"
            >
              Edit
            </button>
          )}
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
