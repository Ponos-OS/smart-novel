import { useNavigate } from 'react-router-dom';

import { Button } from '../../components/Button';
import { ChapterList } from './ChapterList';
import { useNovelOutletContext } from './NovelLayout';

export function ChapterListPage() {
  const { novel, canEditContent, canManageTts } =
    useNovelOutletContext();
  const navigate = useNavigate();

  const goToChapter = (chapterId: string) => {
    navigate(`/novel/${novel.id}/chapters/${chapterId}`);
  };

  const goToCreateChapter = () => {
    navigate(`/novel/${novel.id}/chapters/new`);
  };

  const goToEditChapter = (chapterId: string) => {
    navigate(`/novel/${novel.id}/chapters/${chapterId}/edit`);
  };

  const handleReadFirstChapter = () => {
    if (novel.firstChapter?.id) {
      goToChapter(novel.firstChapter.id);
    }
  };

  const handleReadLatestChapter = () => {
    if (novel.lastPublishedChapter?.id) {
      goToChapter(novel.lastPublishedChapter.id);
    }
  };

  const chapters = novel.chaptersConnection.edges.map(
    (edge) => edge.node,
  );
  const hasChapters = chapters.length > 0;
  const totalChapters = novel.chaptersConnection.totalCount;

  const chaptersInfo = chapters.map((ch) => ({
    id: ch.id,
    title: ch.title ?? null,
    createdAt: ch.createdAt,
    narrationStatus: ch.narrationStatus,
    narrationUrl: ch.narrationUrl,
  }));

  return (
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Chapters ({totalChapters})
          </h2>
          {canEditContent && (
            <Button
              variant="solid"
              color="blue"
              onClick={goToCreateChapter}
            >
              New Chapter
            </Button>
          )}
        </div>
        <ChapterList
          chapters={chaptersInfo}
          onChapterClick={goToChapter}
          onEditClick={goToEditChapter}
          currentChapterId={null}
          canManageTts={canManageTts}
          canEditContent={canEditContent}
          novelId={novel.id}
        />
      </div>
    </>
  );
}
