import { useState } from 'react';

import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { GenerateTtsButton } from '../../components/GenerateTtsButton';
import { Tooltip } from '../../components/Tooltip';
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
  onDelete?: (chapterId: string) => Promise<void>;
  currentChapterId: string | null;
  canManageTts?: boolean;
  canEditContent?: boolean;
  novelId?: string;
}

export function ChapterList({
  chapters,
  onChapterClick,
  onEditClick,
  onDelete,
  currentChapterId,
  canManageTts,
  canEditContent,
  novelId,
}: ChapterListProps) {
  const { isRead } = useReadChapters();
  const [chapterToDelete, setChapterToDelete] =
    useState<ChapterInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const closeDeleteDialog = () => {
    setChapterToDelete(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!chapterToDelete || !onDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onDelete(chapterToDelete.id);
      closeDeleteDialog();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Try again later.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

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
                ? 'border-blue-500 bg-blue-900/30'
                : 'border-gray-700 bg-gray-800'
            }`}
          >
            <button
              onClick={() => onChapterClick(chapter.id)}
              className={`flex flex-1 cursor-pointer items-center rounded-l-lg py-3 pl-3 text-left transition-colors ${
                isActive ? '' : 'hover:bg-gray-700'
              }`}
            >
              <h3
                className={`text-sm font-medium ${
                  read ? 'text-gray-400' : 'text-white'
                }`}
              >
                Chapter {index + 1}
                {chapter.title && `: ${chapter.title}`}
              </h3>
            </button>
            <div className="ml-4 flex items-center gap-3 py-3 pr-3">
              <span className="text-xs text-gray-400">
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
                <Tooltip content="Edit chapter title/content">
                  <Button
                    variant="chip"
                    color="blue"
                    onClick={() => onEditClick(chapter.id)}
                  >
                    Edit
                  </Button>
                </Tooltip>
              )}
              {canEditContent && onDelete && (
                <Tooltip content="Delete chapter">
                  <Button
                    variant="chip"
                    color="red"
                    onClick={() => setChapterToDelete(chapter)}
                  >
                    Delete
                  </Button>
                </Tooltip>
              )}
            </div>
          </div>
        );
      })}
      {chapterToDelete && (
        <ConfirmDialog
          title="Delete chapter"
          message={`Delete "${chapterToDelete.title ?? 'this chapter'}"? Its content, read history and audio are removed permanently, and the chapters after it move up by one.`}
          confirmLabel="Delete"
          isLoading={isDeleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={closeDeleteDialog}
        />
      )}
    </div>
  );
}
