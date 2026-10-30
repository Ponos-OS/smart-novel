export * from '../../src/generated/graphql';

function noopMutation() {
  return { isPending: false, mutate: () => undefined };
}

/** Swapped in for the category mutations by the Storybook Vite plugin: the stories show the screens, not the API. */
export const useApproveCategoryMutation = noopMutation;
export const useUpdateCategoryMutation = noopMutation;
export const useDeleteCategoryMutation = noopMutation;
