import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { ADMIN_NOVELS_KEY } from '../../features/admin-novels/use-admin-novels';
import {
  useContentStatsQuery,
  useCreateNovelMutation,
  useDefaultLicenseQuery,
  useGetNovelsQuery,
  useSearchNovelsQuery,
} from '../../generated/graphql';
import { useCanCreateNovel } from '../../hooks/useCanCreateNovel';
import { showApiError } from '../../utils/notification';
import { NovelForm, NovelFormValues } from './NovelForm';
import { useStoreLicense } from './use-store-license';

export function NovelCreatePage() {
  const { canCreate, loading } = useCanCreateNovel();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createNovelMutation = useCreateNovelMutation();
  const storeLicense = useStoreLicense();
  const { data: licenseData } = useDefaultLicenseQuery(
    {},
    { enabled: canCreate },
  );

  const handleSubmit = async ({
    licenseDraft,
    licenseId,
    ...novel
  }: NovelFormValues) => {
    let storedLicenseId = licenseId;

    try {
      if (licenseDraft) {
        storedLicenseId = await storeLicense.store(licenseDraft);
      }
    } catch {
      showApiError();

      return;
    }

    createNovelMutation.mutate(
      { input: { ...novel, licenseID: storedLicenseId } },
      {
        onSuccess: async (data) => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: useGetNovelsQuery.getKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: useSearchNovelsQuery.getKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: [ADMIN_NOVELS_KEY],
            }),
            queryClient.invalidateQueries({
              queryKey: useContentStatsQuery.getKey(),
            }),
          ]);
          navigate(`/novel/${data.createNovel.id}`);
        },
        onError: () => showApiError(),
      },
    );
  };

  if (loading) {
    return null;
  }

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-400">
        <p>You don't have permission to create a novel.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold text-white">
        New novel
      </h1>
      <div className="rounded-xl border border-gray-700/70 bg-gray-800 p-6">
        <NovelForm
          license={licenseData?.defaultLicense}
          submitLabel="Create novel"
          isSubmitting={
            createNovelMutation.isPending || storeLicense.isPending
          }
          onSubmit={handleSubmit}
          onCancel={() => navigate('/')}
        />
      </div>
    </div>
  );
}
