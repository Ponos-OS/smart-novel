import { useCallback, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { ThemeToggle } from '../../components/ThemeToggle';
import {
  NovelAction,
  useGetChapterQuery,
  useGetNovelQuery,
} from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { useReadChapters } from '../../hooks/useReadChapters';
import { Breadcrumbs } from './Breadcrumbs';
import { ChapterContent } from './ChapterContent';
import { ChapterList } from './ChapterList';

export function NovelPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading: authLoading } = useAuth();
  const { markAsRead } = useReadChapters();
  const requestedChapterId = searchParams.get('chapter');
  const showChapterList = !requestedChapterId;

  // Track previously viewed chapter to detect navigation
  const lastMarkedChapterIdRef = useRef<string | null>(null);

  const {
    data: novelData,
    isLoading: novelLoading,
    error: novelError,
  } = useGetNovelQuery(
    { id: id ?? '' },
    { enabled: !!id && !authLoading },
  );

  const novel = novelData?.novel ?? null;

  const { data: chapterData, isLoading: chapterLoading } =
    useGetChapterQuery(
      { novelId: id ?? '', chapterId: requestedChapterId ?? '' },
      { enabled: !!id && !!requestedChapterId },
    );

  const currentChapter = chapterData?.novel?.chapter ?? undefined;

  const setChapterInUrl = useCallback(
    (chapterId: string | null) => {
      const nextSearchParams = new URLSearchParams(searchParams);

      if (chapterId) {
        nextSearchParams.set('chapter', chapterId);
      } else {
        nextSearchParams.delete('chapter');
      }

      setSearchParams(nextSearchParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Mark chapter as read when it loads
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

  const handleChapterClick = (chapterId: string) => {
    setChapterInUrl(chapterId);
  };

  const handleReadFirstChapter = () => {
    if (novel?.firstChapter?.id) {
      handleChapterClick(novel.firstChapter.id);
    }
  };

  const handleReadLatestChapter = () => {
    if (novel?.lastPublishedChapter?.id) {
      handleChapterClick(novel.lastPublishedChapter.id);
    }
  };

  const handlePreviousChapter = () => {
    if (currentChapter?.previous?.id) {
      setChapterInUrl(currentChapter.previous.id);
    }
  };

  const handleNextChapter = () => {
    if (currentChapter?.next?.id) {
      setChapterInUrl(currentChapter.next.id);
    }
  };

  if (novelLoading && !novel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading novel...
          </p>
        </div>
      </div>
    );
  }

  if (novelError || !novel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-red-600 dark:text-red-400">
          <p>
            {novelError ? 'Failed to fetch novel' : 'Novel not found'}
          </p>
        </div>
      </div>
    );
  }

  const canManageTts =
    novel.allowedActions?.includes(NovelAction.ManageTts) ?? false;
  const chapters = novel.chaptersConnection.edges.map(
    (edge) => edge.node,
  );
  const hasChapters = chapters.length > 0;
  const totalChapters = novel.chaptersConnection.totalCount;

  // Prepare chapter info for ChapterList
  const chaptersInfo = chapters.map((ch) => ({
    id: ch.id,
    title: ch.title ?? null,
    createdAt: ch.createdAt,
    narrationStatus: ch.narrationStatus,
    narrationUrl: ch.narrationUrl,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Theme Toggle - Fixed top-right */}
      <div className="fixed right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumbs
          novelName={novel.name}
          chapterTitle={
            requestedChapterId
              ? (currentChapter?.title ?? null)
              : null
          }
        />

        {showChapterList ? (
          <>
            {/* Novel Header */}
            <div className="mb-8 flex flex-col gap-6 md:flex-row">
              {/* Cover Image */}
              {novel.coverUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={novel.coverUrl}
                    alt={novel.name}
                    className="h-64 w-48 rounded-lg object-cover shadow-lg"
                  />
                </div>
              )}

              {/* Novel Info */}
              <div className="flex-1">
                <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {novel.name}
                </h1>
                <p className="mb-4 text-lg text-gray-600 dark:text-gray-400">
                  By {novel.author}
                </p>
                <p className="mb-4 text-gray-700 dark:text-gray-300">
                  {novel.description}
                </p>
                <div className="mb-4 flex flex-wrap gap-2">
                  {novel.category.map((cat) => (
                    <span
                      key={cat}
                      className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                      {cat}
                    </span>
                  ))}
                </div>

                {/* Read Buttons */}
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={handleReadFirstChapter}
                    disabled={!hasChapters}
                    className="cursor-pointer rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600"
                  >
                    Read First Chapter
                  </button>
                  <button
                    onClick={handleReadLatestChapter}
                    disabled={!hasChapters}
                    className="cursor-pointer rounded-lg border border-blue-600 px-6 py-3 font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:disabled:hover:bg-transparent"
                  >
                    Read Latest Chapter
                  </button>
                </div>
              </div>
            </div>

            {/* Chapters Tab */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                Chapters ({totalChapters})
              </h2>
              <ChapterList
                chapters={chaptersInfo}
                onChapterClick={handleChapterClick}
                currentChapterId={requestedChapterId}
                canManageTts={canManageTts}
                novelId={id}
              />
            </div>
          </>
        ) : currentChapter ? (
          <>
            {/* Back Button */}
            <button
              onClick={() => {
                setChapterInUrl(null);
              }}
              className="cursor-pointer mb-4 text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← Back to Novel
            </button>

            {/* Chapter Content */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              {chapterLoading ? (
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
                  onPrevious={handlePreviousChapter}
                  onNext={handleNextChapter}
                  hasPrevious={!!currentChapter.previous}
                  hasNext={!!currentChapter.next}
                  canManageTts={canManageTts}
                />
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
