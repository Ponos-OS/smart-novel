import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../components/Button';
import { NovelLicenseSection } from '../../features/novel-license/NovelLicenseSection';
import {
  useDeleteChapterMutation,
  useGetNovelQuery,
} from '../../generated/graphql';
import { ChapterList } from './ChapterList';
import { useNovelOutletContext } from './NovelLayout';

export function ChapterListPage() {
  const { novel, canEditContent, canManageTts } =
    useNovelOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deleteChapterMutation = useDeleteChapterMutation();

  const goToChapter = (chapterId: string) => {
    navigate(`/novel/${novel.id}/chapters/${chapterId}`);
  };

  const goToCreateChapter = () => {
    navigate(`/novel/${novel.id}/chapters/new`);
  };

  const goToEditChapter = (chapterId: string) => {
    navigate(`/novel/${novel.id}/chapters/${chapterId}/edit`);
  };

  const goToEditNovel = () => {
    navigate(`/novels/${novel.id}/edit`);
  };

  const handleDeleteChapter = async (chapterId: string) => {
    await deleteChapterMutation.mutateAsync({ id: chapterId });
    await queryClient.invalidateQueries({
      queryKey: useGetNovelQuery.getKey({ id: novel.id }),
    });
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
          <div className="mb-2 flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold text-white">
              {novel.name}
            </h1>
            {canEditContent && (
              <Button
                variant="outline"
                color="gray"
                onClick={goToEditNovel}
              >
                Edit novel
              </Button>
            )}
          </div>
          <p className="mb-4 text-lg text-gray-400">
            By {novel.author}
          </p>
          <p className="mb-4 text-gray-300">{novel.description}</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {novel.category.map((cat) => (
              <span
                key={cat}
                className="rounded-full px-3 py-1 text-sm font-medium bg-blue-900 text-blue-200"
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
              className="cursor-pointer rounded-lg border px-6 py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-blue-500 text-blue-400 hover:bg-blue-900/30 disabled:hover:bg-transparent"
            >
              Read Latest Chapter
            </button>
          </div>
        </div>
      </div>

      {/* Chapters Tab */}
      <div className="rounded-lg border p-6 border-gray-700 bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
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
          onDelete={handleDeleteChapter}
          currentChapterId={null}
          canManageTts={canManageTts}
          canEditContent={canEditContent}
          novelId={novel.id}
        />
      </div>

      <NovelLicenseSection license={novel.license} />
    </>
  );
}
