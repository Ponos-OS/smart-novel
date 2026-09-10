import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import {
  GetChapterQuery,
  NarrationStatus,
  useGenerateChapterAudioMutation,
  useGetChapterQuery,
} from '../generated/graphql';

interface GenerateTtsButtonProps {
  novelId: string;
  chapterId: string;
  /** Whether the chapter already has a narration — gates the regenerate-confirmation modal */
  hasNarrationUrl?: boolean;
}

export function GenerateTtsButton({
  novelId,
  chapterId,
  hasNarrationUrl,
}: GenerateTtsButtonProps) {
  const queryClient = useQueryClient();
  const [showRegenerateConfirm, setShowRegenerateConfirm] =
    useState(false);
  const generateAudioMutation = useGenerateChapterAudioMutation();

  const updateCacheNarrationStatus = useCallback(
    (status: NarrationStatus, narrationUrl?: string | null) => {
      const queryKey = useGetChapterQuery.getKey({
        novelId,
        chapterId,
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
              narrationStatus: status,
              ...(narrationUrl !== undefined && { narrationUrl }),
            },
          },
        };
      });
    },
    [chapterId, novelId, queryClient],
  );

  const generate = useCallback(() => {
    updateCacheNarrationStatus(NarrationStatus.Processing);

    generateAudioMutation.mutate(
      { id: chapterId },
      {
        onSuccess: (data) => {
          const result = data.generateChapterAudio;
          updateCacheNarrationStatus(
            result.status,
            result.narrationUrl,
          );
        },
        onError: () => {
          updateCacheNarrationStatus(NarrationStatus.Failed);
        },
      },
    );
    setShowRegenerateConfirm(false);
  }, [chapterId, generateAudioMutation, updateCacheNarrationStatus]);

  const handleClick = () => {
    if (hasNarrationUrl) {
      setShowRegenerateConfirm(true);
      return;
    }
    generate();
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={generateAudioMutation.isPending}
        className="cursor-pointer rounded bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800 transition-colors hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800"
        title={
          hasNarrationUrl
            ? 'Regenerate audio narration (will replace the existing one)'
            : 'Generate audio narration for this chapter'
        }
      >
        {hasNarrationUrl
          ? '🔄 Regenerate Audio'
          : '🔊 Generate Audio'}
      </button>

      {showRegenerateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Regenerate Audio Narration?
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              This chapter already has an audio narration.
              Regenerating will permanently replace the existing audio
              file with a new one. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={generate}
                className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Yes, Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
