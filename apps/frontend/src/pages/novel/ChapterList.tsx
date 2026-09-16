import { Button } from '../../components/Button';
import { GenerateTtsButton } from '../../components/GenerateTtsButton';
import { NarrationStatus } from '../../generated/graphql';
import { useReadChapters } from '../../hooks/useReadChapters';

interface ChapterInfo {
  id: string;
  title: string | null;
  createdAt: string;
  narrationStatus?: NarrationStatus | null;
  narrationUrl?: string | null;
}

interface ChapterListProps {
  chapters: ChapterInfo[];
  onChapterClick: (chapterId: string) => void;
  onEditClick: (chapterId: string) => void;
  currentChapterId: string | null;
  canManageTts?: boolean;
  canEditContent?: boolean;
  novelId?: string;
}

export function ChapterList({
  chapters,
  onChapterClick,
  onEditClick,
  currentChapterId,
  canManageTts,
  canEditContent,
  novelId,
}: ChapterListProps) {
  const { isRead } = useReadChapters();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-2">
      {chapters.map((chapter, index) => {
        const read = isRead(chapter.id);
        const isActive = currentChapterId === chapter.id;

        return (
          <div
            key={chapter.id}
            className={`flex w-full items-stretch rounded-lg border transition-colors ${
              isActive
                ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30'
                : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
            }`}
          >
            <button
              onClick={() => onChapterClick(chapter.id)}
              className={`flex flex-1 cursor-pointer items-center rounded-l-lg py-3 pl-3 text-left transition-colors ${
                isActive
                  ? ''
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <h3
                className={`text-sm font-medium ${
                  read
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                Chapter {index + 1}
                {chapter.title && `: ${chapter.title}`}
              </h3>
            </button>
            <div className="ml-4 flex items-center gap-3 py-3 pr-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(chapter.createdAt)}
              </span>
              {canManageTts && novelId && (
                <GenerateTtsButton
                  novelId={novelId}
                  chapterId={chapter.id}
                  narrationStatus={chapter.narrationStatus}
                  narrationUrl={chapter.narrationUrl}
                />
              )}
              {canEditContent && (
                <Button
                  variant="chip"
                  color="blue"
                  onClick={() => onEditClick(chapter.id)}
                  title="Edit chapter title/content"
                >
                  Edit
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
