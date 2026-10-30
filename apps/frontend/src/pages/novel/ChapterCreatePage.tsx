import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../../components/Button';
import { useCreateChapterMutation } from '../../generated/graphql';
import { showApiError } from '../../utils/notification';
import { useNovelOutletContext } from './NovelLayout';

export function ChapterCreatePage() {
  const { novel, canEditContent } = useNovelOutletContext();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const createChapterMutation = useCreateChapterMutation();

  const canSubmit =
    !createChapterMutation.isPending &&
    title.trim().length > 0 &&
    content.trim().length > 0;

  const handleCancel = () => {
    navigate(`/novel/${novel.id}`);
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    createChapterMutation.mutate(
      { novelId: novel.id, input: { title, content } },
      {
        onSuccess: (data) => {
          navigate(
            `/novel/${novel.id}/chapters/${data.createChapter.id}/edit`,
          );
        },
        onError: () => showApiError(),
      },
    );
  };

  if (!canEditContent) {
    return (
      <div className="rounded-xl border border-gray-700/70 bg-gray-800 p-6">
        <div className="text-center text-red-400">
          <p>You don't have permission to create a chapter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/70 bg-gray-800 p-6">
      <div className="border-b pb-4 border-gray-700">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={createChapterMutation.isPending}
          placeholder="Chapter title"
          className="w-full rounded-lg border px-3 py-2 text-2xl font-bold disabled:opacity-50 border-gray-600 bg-gray-900 text-white"
        />
      </div>

      <div className="prose-container mt-4">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={createChapterMutation.isPending}
          rows={20}
          placeholder="Chapter content in markdown format"
          className="w-full rounded-lg border px-3 py-2 font-mono text-sm disabled:opacity-50 border-gray-600 bg-gray-900 text-white"
        />
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <Button
          variant="outline"
          color="gray"
          onClick={handleCancel}
          disabled={createChapterMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          variant="solid"
          color="blue"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          Create Chapter
        </Button>
      </div>
    </div>
  );
}
