import {
  type LicenseAssistantDraftInput,
  useCreateLicenseDraftMutation,
  useDiscardLicenseDraftMutation,
  useFinalizeLicenseDraftMutation,
  useSaveLicenseDraftMutation,
} from '../../generated/graphql';

/**
 * @description Stores a license text the writer typed as a license of their own, which a novel can then use by its ID: a draft is started, saved and finalized. A draft that could not be finished is thrown away, so failed tries do not use up the writer's unfinished drafts.
 */
export function useStoreLicense() {
  const create = useCreateLicenseDraftMutation();
  const save = useSaveLicenseDraftMutation();
  const finalize = useFinalizeLicenseDraftMutation();
  const discard = useDiscardLicenseDraftMutation();

  return {
    isPending:
      create.isPending || save.isPending || finalize.isPending,
    store: async (
      draft: LicenseAssistantDraftInput,
    ): Promise<string> => {
      const { createLicenseDraft } = await create.mutateAsync({
        input: {},
      });

      try {
        await save.mutateAsync({
          input: { id: createLicenseDraft.id, ...draft },
        });
        const { finalizeLicenseDraft } = await finalize.mutateAsync({
          id: createLicenseDraft.id,
        });

        return finalizeLicenseDraft.id;
      } catch (error) {
        await discard
          .mutateAsync({ id: createLicenseDraft.id })
          .catch(() => undefined);
        throw error;
      }
    },
  };
}
