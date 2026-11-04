import { GraphqlRequestError } from '../../src/lib/graphql-fetcher';

type Outcome = 'noop' | 'success' | 'refused';

/** Swapped in for `useRequestTagMutation` by the Storybook Vite plugin — flip before rendering a story to drive the pending, refused and success states. */
export const mockRequestTagState: {
  isPending: boolean;
  outcome: Outcome;
} = { isPending: false, outcome: 'noop' };

export function useRequestTagMutation() {
  return {
    isPending: mockRequestTagState.isPending,
    mutate: (
      variables: { input: { name: string; description: string } },
      options?: {
        onSuccess?: (data: { requestTag: { name: string } }) => void;
        onError?: (error: unknown) => void;
      },
    ) => {
      const name = variables.input.name.trim().toLowerCase();

      if (mockRequestTagState.outcome === 'success') {
        options?.onSuccess?.({ requestTag: { name } });
      } else if (mockRequestTagState.outcome === 'refused') {
        options?.onError?.(
          new GraphqlRequestError(
            `The tag "${name}" already exists or was already requested. Search for "${name}" instead.`,
            { code: 'BAD_REQUEST' },
          ),
        );
      }
    },
  };
}
