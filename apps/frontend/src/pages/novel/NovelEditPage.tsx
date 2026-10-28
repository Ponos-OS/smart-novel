import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  NovelAction,
  useGetNovelQuery,
  useUpdateNovelMutation,
} from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { showApiError } from '../../utils/notification';
import { NovelForm, NovelFormValues } from './NovelForm';

export function NovelEditPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const { loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateNovelMutation = useUpdateNovelMutation();

  const { data, isLoading, error } = useGetNovelQuery(
    { id: novelId ?? '' },
    { enabled: !!novelId && !authLoading },
  );
  const novel = data?.novel;

  const handleSubmit = (input: NovelFormValues) => {
    if (!novel) {
      return;
    }

    updateNovelMutation.mutate(
      { id: novel.id, input },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: useGetNovelQuery.getKey({ id: novel.id }),
          });
          navigate(`/novel/${novel.id}`);
        },
        onError: () => showApiError(),
      },
    );
  };

  if (authLoading || isLoading) {
    return <LoadingSpinner label="Loading novel..." />;
  }

  if (error || !novel) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-600 dark:text-red-400">
        <p>{error ? 'Failed to fetch novel' : 'Novel not found'}</p>
      </div>
    );
  }

  if (!novel.allowedActions?.includes(NovelAction.EditContent)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-600 dark:text-red-400">
        <p>You don't have permission to edit this novel.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
        Edit novel
      </h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <NovelForm
          initialValues={{
            name: novel.name,
            author: novel.author,
            description: novel.description,
            state: novel.state,
            categories: novel.category,
          }}
          submitLabel="Save"
          isSubmitting={updateNovelMutation.isPending}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/novel/${novel.id}`)}
        />
      </div>
    </div>
  );
}
