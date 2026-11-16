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
  narrationUrl: narrationUrlProp,
}: GenerateTtsButtonProps) {
  const queryClient = useQueryClient();
  const [showRegenerateConfirm, setShowRegenerateConfirm] =
    useState(false);
  const [isProcessing, setIsProcessing] = useState(
    narrationStatus === NarrationStatus.Processing,
  );
  const [narrationUrl, setNarrationUrl] = useState(
    narrationUrlProp ?? null,
  );
  const [stage, setStage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
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
              ...(url !== undefined && { narrationURL: url }),
            },
          },
        };
      });
    },
    [chapterId, novelId, queryClient],
  );

  // An event sent while the connection was down, or before it was up, is lost. The chapter has the outcome, so it is read again each time the connection is up, and what it says ends the wait. Adjusted while rendering, as React advises for state that follows a prop.
  const [seen, setSeen] = useState({
    status: narrationStatus,
    url: narrationUrlProp,
  });

  if (
    seen.status !== narrationStatus ||
    seen.url !== narrationUrlProp
  ) {
    setSeen({ status: narrationStatus, url: narrationUrlProp });

    if (narrationStatus === NarrationStatus.Ready) {
      setIsProcessing(false);
      setFailed(false);
      setNarrationUrl(narrationUrlProp ?? null);
    } else if (narrationStatus === NarrationStatus.Failed) {
      setIsProcessing(false);
      setFailed(true);
    }
  }

  useGraphQLSubscription<ChapterNarrationUpdatedSubscription>({
    query: ChapterNarrationUpdatedDocument.toString(),
    variables: { chapterId },
    enabled: isProcessing,
    onConnected: () => {
      setIsReconnecting(false);
      void queryClient.invalidateQueries({
        queryKey: useGetChapterQuery.getKey({ novelId, chapterId }),
      });
    },
    onDisconnected: () => setIsReconnecting(true),
    onData: (data) => {
      const event = data.chapterNarrationUpdated;
      setStage(event.stage ?? null);

      if (event.status === NarrationStatus.Ready) {
        setIsProcessing(false);
        setNarrationUrl(event.narrationURL ?? narrationUrl);
        setFailed(false);
        patchChapterCache(event.status, event.narrationURL);
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

  let stageLabel = 'Starting...';

  if (isReconnecting) {
    stageLabel = 'Reconnecting...';
  } else if (stage) {
    stageLabel = `${STAGE_LABELS[stage] ?? stage}...`;
  }

  return (
    <>
      {isProcessing ? (
        <div className="flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium bg-blue-900 text-blue-200">
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
        <span className="text-xs text-red-400">
          Audio generation failed.
        </span>
      )}

      {showRegenerateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-lg p-6 shadow-xl bg-gray-800">
            <h3 className="mb-2 text-lg font-semibold text-white">
              Regenerate Audio Narration?
            </h3>
            <p className="mb-4 text-sm text-gray-400">
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
