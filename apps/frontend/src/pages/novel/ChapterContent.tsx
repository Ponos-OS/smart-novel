import { useRef } from 'react';

import { GenerateTtsButton } from '../../components/GenerateTtsButton';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';
import { Chapter, NarrationStatus } from '../../generated/graphql';
import { useChapterNarrationSubscription } from '../../hooks/useChapterNarrationSubscription';

/** @description Beatrice's in-progress stages, in order — used to size the progress bar. */
const NARRATION_STAGES = [
  'queued',
  'generating',
  'uploading',
] as const;
const NARRATION_STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  generating: 'Generating',
  uploading: 'Uploading',
};

type ChapterContentData = Pick<
  Chapter,
  | 'id'
  | 'novelId'
  | 'title'
  | 'content'
  | 'updatedAt'
  | 'narrationStatus'
  | 'narrationUrl'
>;

interface ChapterContentProps {
  chapter: ChapterContentData;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  canManageTts?: boolean;
}

export function ChapterContent({
  chapter,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  canManageTts,
}: ChapterContentProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Derive UI state directly from the chapter prop (sourced from TanStack Query cache)
  const hasNarrationUrl = !!chapter.narrationUrl;
  const isProcessing =
    chapter.narrationStatus === NarrationStatus.Processing;
  const isFailed = chapter.narrationStatus === NarrationStatus.Failed;

  // Subscribe to real-time narration updates when processing
  // The subscription updates the TanStack Query cache directly
  const { stage } = useChapterNarrationSubscription({
    chapterId: chapter.id,
    novelId: chapter.novelId,
    enabled: isProcessing,
  });
  const stageIndex = stage
    ? NARRATION_STAGES.indexOf(
        stage as (typeof NARRATION_STAGES)[number],
      )
    : -1;
  const stageProgressPercent =
    stageIndex >= 0
      ? ((stageIndex + 1) / NARRATION_STAGES.length) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Navigation Buttons - Top */}
      <div className="flex justify-between">
        <button
          onClick={onPrevious}
          disabled={!hasPrevious}
          className="cursor-pointer rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          ← Previous
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="cursor-pointer rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Next →
        </button>
      </div>

      {/* Chapter Title */}
      <div className="border-b border-gray-200 pb-4 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {chapter.title || `Chapter ${chapter.id}`}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Updated: {new Date(chapter.updatedAt).toLocaleDateString()}
        </p>
      </div>

      {/* Audio Narration Section */}
      {hasNarrationUrl && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="mb-2 flex items-center gap-2">
            <svg
              className="h-5 w-5 text-blue-600 dark:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
              />
            </svg>
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Audio Narration
            </span>
          </div>
          <audio
            ref={audioRef}
            controls
            className="w-full"
            src={chapter.narrationUrl!}
            preload="metadata"
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Writer Controls: Generate TTS / Generate Audio */}
      {canManageTts && (
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

          {/* Generate / Regenerate Narration */}
          {isProcessing ? (
            <div className="flex min-w-[180px] flex-1 flex-col gap-1 rounded bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              <span>
                {stage
                  ? `${NARRATION_STAGE_LABELS[stage] ?? stage}...`
                  : 'Generating audio...'}
              </span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300 dark:bg-blue-400"
                  style={{ width: `${stageProgressPercent}%` }}
                />
              </div>
            </div>
          ) : (
            <GenerateTtsButton
              novelId={chapter.novelId}
              chapterId={chapter.id}
              hasNarrationUrl={hasNarrationUrl}
            />
          )}

          {isFailed && (
            <span className="text-xs text-red-600 dark:text-red-400">
              Audio generation failed.
            </span>
          )}
        </div>
      )}

      {/* Chapter Content */}
      <div className="prose-container">
        <MarkdownRenderer content={chapter.content} />
      </div>

      {/* Navigation Buttons - Bottom */}
      <div className="flex justify-between border-t border-gray-200 pt-6 dark:border-gray-700">
        <button
          onClick={onPrevious}
          disabled={!hasPrevious}
          className="cursor-pointer rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          ← Previous
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="cursor-pointer rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
