import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useGetChapterQuery } from '../../generated/graphql';
import { useReadChapters } from '../../hooks/useReadChapters';
import { ChapterContent } from './ChapterContent';
import { useNovelOutletContext } from './NovelLayout';

export function ChapterReadPage() {
  const { novel, canEditContent, canManageTts } =
    useNovelOutletContext();
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const { markAsRead } = useReadChapters();

  const lastMarkedChapterIdRef = useRef<string | null>(null);

  const { data: chapterData, isLoading: chapterLoading } =
    useGetChapterQuery(
      { novelId: novel.id, chapterId: chapterId ?? '' },
      { enabled: !!chapterId },
    );

  const currentChapter = chapterData?.novel?.chapter ?? undefined;

  useEffect(() => {
    if (
      currentChapter?.id &&
      currentChapter.id !== lastMarkedChapterIdRef.current
    ) {
      markAsRead(currentChapter.id);
      lastMarkedChapterIdRef.current = currentChapter.id;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentChapter?.id, markAsRead]);

  const handlePrevious = () => {
    if (currentChapter?.previous?.id) {
      navigate(
        `/novel/${novel.id}/chapters/${currentChapter.previous.id}`,
      );
    }
  };

  const handleNext = () => {
    if (currentChapter?.next?.id) {
      navigate(
        `/novel/${novel.id}/chapters/${currentChapter.next.id}`,
      );
    }
  };

  const handleEditClick = () => {
    if (currentChapter?.id) {
      navigate(
        `/novel/${novel.id}/chapters/${currentChapter.id}/edit`,
      );
    }
  };

  return (
    <>
      {/* Back Button */}
      <button
        onClick={() => navigate(`/novel/${novel.id}`)}
        className="cursor-pointer mb-4 text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        ← Back to Novel
      </button>

      {/* Chapter Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        {chapterLoading || !currentChapter ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <p className="text-gray-600 dark:text-gray-400">
                Loading chapter...
              </p>
            </div>
          </div>
        ) : (
          <ChapterContent
            chapter={currentChapter}
            onPrevious={handlePrevious}
            onNext={handleNext}
            hasPrevious={!!currentChapter.previous}
            hasNext={!!currentChapter.next}
            canManageTts={canManageTts}
            canEditContent={canEditContent}
            onEditClick={handleEditClick}
          />
        )}
      </div>
    </>
  );
}
