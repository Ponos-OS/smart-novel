export * from '../../src/generated/graphql';

function noopMutation() {
  return { isPending: false, mutate: () => undefined };
}

/** Swapped in for the writer request mutations by the Storybook Vite plugin: the stories show the screens, not the API. */
export const useApproveWriterRequestMutation = noopMutation;
export const useRejectWriterRequestMutation = noopMutation;
