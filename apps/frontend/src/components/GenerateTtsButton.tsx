import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import {
  ChapterNarrationUpdatedDocument,
  ChapterNarrationUpdatedSubscription,
  GetChapterQuery,
  NarrationStatus,
  useGenerateChapterAudioMutation,
  useGetChapterQuery,
} from '../generated/graphql';
import { useGraphQLSubscription } from '../hooks/useGraphQLSubscription';
import { Button } from './Button';

/** @description Maps Beatrice's raw in-progress stage to user-friendly text. */
const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  generating: 'Generating',
  uploading: 'Uploading',
};

interface GenerateTtsButtonProps {
  novelId: string;
  chapterId: string;
  /** Initial narration status, from whichever query already loaded it. */
  narrationStatus?: NarrationStatus | null;
  /** Initial narration URL, from whichever query already loaded it. */
  narrationUrl?: string | null;
}

export function GenerateTtsButton({
  novelId,
  chapterId,
  narrationStatus,
  narrationUrl: initialNarrationUrl,
}: GenerateTtsButtonProps) {
  const queryClient = useQueryClient();
  const [showRegenerateConfirm, setShowRegenerateConfirm] =
    useState(false);
  const [isProcessing, setIsProcessing] = useState(
    narrationStatus === NarrationStatus.Processing,
  );
  const [narrationUrl, setNarrationUrl] = useState(
    initialNarrationUrl ?? null,
  );
  const [stage, setStage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const generateAudioMutation = useGenerateChapterAudioMutation();
  const hasNarrationUrl = !!narrationUrl;

  const patchChapterCache = useCallback(
    (status: NarrationStatus, url?: string | null) => {
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
              ...(url !== undefined && { narrationUrl: url }),
            },
          },
        };
      });
    },
    [chapterId, novelId, queryClient],
  );

  useGraphQLSubscription<ChapterNarrationUpdatedSubscription>({
    query: ChapterNarrationUpdatedDocument.toString(),
    variables: { chapterId },
    enabled: isProcessing,
    onData: (data) => {
      const event = data.chapterNarrationUpdated;
      setStage(event.stage ?? null);

      if (event.status === NarrationStatus.Ready) {
        setIsProcessing(false);
        setNarrationUrl(event.narrationUrl ?? narrationUrl);
        setFailed(false);
        patchChapterCache(event.status, event.narrationUrl);
      } else if (event.status === NarrationStatus.Failed) {
        setIsProcessing(false);
        setFailed(true);
        patchChapterCache(event.status);
      }
    },
  });

  const generate = useCallback(() => {
    setFailed(false);
    setStage(null);
    setIsProcessing(true);

    generateAudioMutation.mutate(
      { id: chapterId },
      {
        onError: () => {
          setIsProcessing(false);
          setFailed(true);
        },
      },
    );
    setShowRegenerateConfirm(false);
  }, [chapterId, generateAudioMutation]);

  const handleClick = () => {
    if (hasNarrationUrl) {
      setShowRegenerateConfirm(true);
      return;
    }
    generate();
  };

  const stageLabel = stage
    ? `${STAGE_LABELS[stage] ?? stage}...`
    : 'Starting...';

  return (
    <>
      {isProcessing ? (
        <div className="flex items-center gap-2 rounded bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <span
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <span>{stageLabel}</span>
        </div>
      ) : (
        <Button
          variant="chip"
          color="green"
          onClick={handleClick}
          disabled={generateAudioMutation.isPending}
          title={
            hasNarrationUrl
              ? 'Regenerate audio narration (will replace the existing one)'
              : 'Generate audio narration for this chapter'
          }
        >
          {hasNarrationUrl
            ? '🔄 Regenerate Audio'
            : '🔊 Generate Audio'}
        </Button>
      )}

      {failed && !isProcessing && (
        <span className="text-xs text-red-600 dark:text-red-400">
          Audio generation failed.
        </span>
      )}

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
              <Button
                variant="outline"
                color="gray"
                onClick={() => setShowRegenerateConfirm(false)}
              >
                Cancel
              </Button>
              <Button variant="solid" color="red" onClick={generate}>
                Yes, Regenerate
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
