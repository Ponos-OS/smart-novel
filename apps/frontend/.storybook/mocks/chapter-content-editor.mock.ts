import type {
  Chapter,
  GetChapterQuery,
} from '../../src/generated/graphql';

export type { Chapter, GetChapterQuery };

/** Swapped in for `useUpdateContentMutation`/`useUpdateChapterMutation`/`useUpdateChapterAndContentMutation` by the Storybook Vite plugin — flip before rendering a story to drive the "saving" state. */
export const mockMutationState = {
  isPending: false,
};

function useMockMutation() {
  return {
    mutate: () => undefined,
    isPending: mockMutationState.isPending,
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
