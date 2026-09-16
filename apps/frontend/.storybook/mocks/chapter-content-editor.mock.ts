import type {
  Chapter,
  GetChapterQuery,
} from '../../src/generated/graphql';

import { GraphqlRequestError } from '../../src/lib/graphql-fetcher';

export type { Chapter, GetChapterQuery };

type MutationOutcome = 'noop' | 'success' | 'error' | 'conflict';

/** Swapped in for `useUpdateContentMutation`/`useUpdateChapterMutation`/`useUpdateChapterAndContentMutation` by the Storybook Vite plugin — flip before rendering a story to drive the "saving"/error/conflict states. */
export const mockMutationState: {
  isPending: boolean;
  outcome: MutationOutcome;
} = {
  isPending: false,
  outcome: 'noop',
};

function useMockMutation() {
  return {
    isPending: mockMutationState.isPending,
    mutate: (
      _variables: unknown,
      options?: {
        onSuccess?: () => void;
        onError?: (error: unknown) => void;
      },
    ) => {
      if (mockMutationState.outcome === 'success') {
        options?.onSuccess?.();
      } else if (mockMutationState.outcome === 'error') {
        options?.onError?.(new Error('Network error'));
      } else if (mockMutationState.outcome === 'conflict') {
        options?.onError?.(
          new GraphqlRequestError(
            'This chapter was updated by someone else. Reload to get the latest version before saving.',
            { code: 'CONFLICT', status: 409 },
          ),
        );
      }
    },
  };
}

export const useUpdateContentMutation = useMockMutation;
export const useUpdateChapterMutation = useMockMutation;
export const useUpdateChapterAndContentMutation = useMockMutation;

export const useGetChapterQuery = Object.assign(() => undefined, {
  getKey: (variables: { novelId: string; chapterId: string }) => [
    'GetChapter',
    variables,
  ],
});
