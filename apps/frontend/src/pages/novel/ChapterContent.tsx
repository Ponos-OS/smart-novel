import { useRef } from 'react';

import { Button } from '../../components/Button';
import { Chapter } from '../../generated/graphql';
import { ChapterContentEditor } from './ChapterContentEditor';

type ChapterContentData = Pick<
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

interface ChapterContentProps {
  chapter: ChapterContentData;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  canManageTts?: boolean;
  canEditContent?: boolean;
  onEditClick?: () => void;
}

export function ChapterContent({
  chapter,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  canManageTts,
  canEditContent,
  onEditClick,
}: ChapterContentProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Derive UI state directly from the chapter prop (sourced from TanStack Query cache)
  const hasNarrationUrl = !!chapter.narrationUrl;

  return (
    <div className="space-y-6">
      {/* Navigation Buttons - Top */}
      <div className="flex justify-between">
        <Button
          variant="solid"
          color="gray"
          onClick={onPrevious}
          disabled={!hasPrevious}
        >
          ← Previous
        </Button>
        <Button
          variant="solid"
          color="gray"
          onClick={onNext}
          disabled={!hasNext}
        >
          Next →
        </Button>
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

      {/* Chapter Title & Content, incl. Writer Tools: Edit / Generate TTS */}
      <ChapterContentEditor
        chapter={chapter}
        canEdit={!!canEditContent}
        canManageTts={canManageTts}
        onEditClick={onEditClick}
      />

      {/* Navigation Buttons - Bottom */}
      <div className="flex justify-between border-t border-gray-200 pt-6 dark:border-gray-700">
        <Button
          variant="solid"
          color="gray"
          onClick={onPrevious}
          disabled={!hasPrevious}
        >
          ← Previous
        </Button>
        <Button
          variant="solid"
          color="gray"
          onClick={onNext}
          disabled={!hasNext}
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
