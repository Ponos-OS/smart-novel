import { useNavigate } from 'react-router-dom';

import { useCreateNovelMutation } from '../../generated/graphql';
import { useCanCreateNovel } from '../../hooks/useCanCreateNovel';
import { showApiError } from '../../utils/notification';
import { NovelForm, NovelFormValues } from './NovelForm';

export function NovelCreatePage() {
  const { canCreate, loading } = useCanCreateNovel();
  const navigate = useNavigate();
  const createNovelMutation = useCreateNovelMutation();

  const handleSubmit = (input: NovelFormValues) => {
    createNovelMutation.mutate(
      { input },
      {
        onSuccess: (data) =>
          navigate(`/novel/${data.createNovel.id}`),
        onError: () => showApiError(),
      },
    );
  };

  if (loading) {
    return null;
  }

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-600 dark:text-red-400">
        <p>You don't have permission to create a novel.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
        New novel
      </h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <NovelForm
          submitLabel="Create novel"
          isSubmitting={createNovelMutation.isPending}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/')}
        />
      </div>
    </div>
  );
}
