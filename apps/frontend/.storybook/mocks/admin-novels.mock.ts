export * from '../../src/generated/graphql';

/** Swapped in for the delete mutation by the Storybook Vite plugin: the stories show the screen, not the API. */
export function useDeleteNovelMutation() {
  return { isPending: false, mutate: () => undefined };
}
