export * from '../../src/generated/graphql';

function noopMutation() {
  return { isPending: false, mutate: () => undefined };
}

/** Swapped in for the tag mutations by the Storybook Vite plugin: the stories show the screens, not the API. */
export const useApproveTagMutation = noopMutation;
export const useUpdateTagMutation = noopMutation;
export const useDeleteTagMutation = noopMutation;
