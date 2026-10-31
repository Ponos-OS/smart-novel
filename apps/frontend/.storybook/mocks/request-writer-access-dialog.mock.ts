import { GraphqlRequestError } from '../../src/lib/graphql-fetcher';

type Outcome = 'noop' | 'success' | 'refused';

/** Swapped in for `useRequestWriterAccessMutation` by the Storybook Vite plugin — flip before rendering a story to drive the pending, refused and success states. */
export const mockRequestWriterAccessState: {
  isPending: boolean;
  outcome: Outcome;
} = { isPending: false, outcome: 'noop' };

export function useRequestWriterAccessMutation() {
  return {
    isPending: mockRequestWriterAccessState.isPending,
    mutate: (
      _variables: { note: string },
      options?: {
        onSuccess?: () => void;
        onError?: (error: unknown) => void;
      },
    ) => {
      if (mockRequestWriterAccessState.outcome === 'success') {
        options?.onSuccess?.();
      } else if (mockRequestWriterAccessState.outcome === 'refused') {
        options?.onError?.(
          new GraphqlRequestError(
            'You already have a pending writer request',
            { code: 'BAD_REQUEST' },
          ),
        );
      }
    },
  };
}
