type MutationOutcome = 'noop' | 'success' | 'error';

/** Swapped in for `useCreateChapterMutation` by the Storybook Vite plugin — flip before rendering a story to drive the "saving"/error/success states. */
export const mockCreateChapterMutationState: {
  isPending: boolean;
  outcome: MutationOutcome;
  createdChapterId: string;
} = {
  isPending: false,
  outcome: 'noop',
  createdChapterId: 'e0e19c33-2e56-4f5f-9b7c-9c17e7dbd230',
};

export function useCreateChapterMutation() {
  return {
    isPending: mockCreateChapterMutationState.isPending,
    mutate: (
      _variables: unknown,
      options?: {
        onSuccess?: (data: { createChapter: { id: string } }) => void;
        onError?: (error: unknown) => void;
      },
    ) => {
      if (mockCreateChapterMutationState.outcome === 'success') {
        options?.onSuccess?.({
          createChapter: {
            id: mockCreateChapterMutationState.createdChapterId,
          },
        });
      } else if (mockCreateChapterMutationState.outcome === 'error') {
        options?.onError?.(new Error('Network error'));
      }
    },
  };
}
