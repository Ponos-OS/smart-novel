import { useNavigate, useParams } from 'react-router-dom';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useGetChapterQuery } from '../../generated/graphql';
import { ChapterContentEditor } from './ChapterContentEditor';
import { useNovelOutletContext } from './NovelLayout';

export function ChapterEditPage() {
  const { novel, canEditContent, canManageTts } =
    useNovelOutletContext();
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();

  const { data: chapterData, isLoading: chapterLoading } =
    useGetChapterQuery(
      { novelId: novel.id, chapterId: chapterId ?? '' },
      { enabled: !!chapterId },
    );

  const currentChapter = chapterData?.novel?.chapter ?? undefined;

  const backToRead = () => {
    navigate(`/novel/${novel.id}/chapters/${chapterId}`);
  };

  if (!canEditContent) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="text-center text-red-600 dark:text-red-400">
          <p>You don't have permission to edit this chapter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      {chapterLoading || !currentChapter ? (
        <LoadingSpinner label="Loading chapter..." />
      ) : (
        <ChapterContentEditor
          chapter={currentChapter}
          canEdit={canEditContent}
          canManageTts={canManageTts}
          startInEditMode
          onCancel={backToRead}
          onSaved={backToRead}
        />
      )}
    </div>
  );
}
