import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  NovelAction,
  useDeleteNovelMutation,
  useGetNovelQuery,
  useGetNovelsQuery,
  useSearchNovelsQuery,
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
  const deleteNovelMutation = useDeleteNovelMutation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
  };

  const handleDelete = () => {
    if (!novel) {
      return;
    }

    setDeleteError(null);
    deleteNovelMutation.mutate(
      { id: novel.id },
      {
        onSuccess: async () => {
          queryClient.removeQueries({
            queryKey: useGetNovelQuery.getKey({ id: novel.id }),
          });
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: useGetNovelsQuery.getKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: useSearchNovelsQuery.getKey(),
            }),
          ]);
          navigate('/');
        },
        onError: (mutationError) =>
          setDeleteError(
            mutationError instanceof Error
              ? mutationError.message
              : 'Something went wrong. Try again later.',
          ),
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

      <div className="mt-6 flex items-center justify-between rounded-lg border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-gray-800">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white">
            Delete this novel
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Its chapters, read history, audio and cover are removed
            permanently.
          </p>
        </div>
        <Button
          variant="solid"
          color="red"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          Delete novel
        </Button>
      </div>

      {isDeleteDialogOpen && (
        <ConfirmDialog
          title="Delete novel"
          message={`Delete "${novel.name}" with all of its chapters? This cannot be undone.`}
          confirmLabel="Delete"
          confirmationText={novel.name}
          isLoading={deleteNovelMutation.isPending}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={closeDeleteDialog}
        />
      )}
    </div>
  );
}
