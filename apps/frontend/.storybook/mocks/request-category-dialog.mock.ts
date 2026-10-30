import { GraphqlRequestError } from '../../src/lib/graphql-fetcher';

type Outcome = 'noop' | 'success' | 'refused';

/** Swapped in for `useRequestCategoryMutation` by the Storybook Vite plugin — flip before rendering a story to drive the pending, refused and success states. */
export const mockRequestCategoryState: {
  isPending: boolean;
  outcome: Outcome;
} = { isPending: false, outcome: 'noop' };

export function useRequestCategoryMutation() {
  return {
    isPending: mockRequestCategoryState.isPending,
    mutate: (
      variables: { name: string },
      options?: {
        onSuccess?: (data: {
          requestCategory: { name: string };
        }) => void;
        onError?: (error: unknown) => void;
      },
    ) => {
      const name = variables.name.trim().toLowerCase();

      if (mockRequestCategoryState.outcome === 'success') {
        options?.onSuccess?.({ requestCategory: { name } });
      } else if (mockRequestCategoryState.outcome === 'refused') {
        options?.onError?.(
          new GraphqlRequestError(
            `The category "${name}" already exists or was already requested. Search for "${name}" instead.`,
            { code: 'BAD_REQUEST' },
          ),
        );
      }
    },
  };
}
