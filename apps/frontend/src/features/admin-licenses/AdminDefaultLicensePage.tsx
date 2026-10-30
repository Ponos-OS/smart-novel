import { Role } from '@smart-novel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  type LicenseDraftInput,
  useDefaultLicenseQuery,
  useSetDefaultLicenseMutation,
} from '../../generated/graphql';
import { useAuth } from '../../hooks/useAuth';
import { showSuccess } from '../../utils/notification';
import { LicenseField } from '../novel-license/LicenseField';

export function AdminDefaultLicensePage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.roles.includes(Role.admin);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useDefaultLicenseQuery(
    {},
    { enabled: isAdmin },
  );
  const setDefaultLicense = useSetDefaultLicenseMutation();
  const [draft, setDraft] = useState<LicenseDraftInput>();
  const [isConfirming, setIsConfirming] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const license = data?.defaultLicense;

  const closeDialog = () => {
    setIsConfirming(false);
    setDefaultLicense.reset();
  };

  const handleConfirm = () => {
    if (!draft) {
      return;
    }

    setDefaultLicense.mutate(
      { input: { licenseDraft: draft } },
      {
        onSuccess: (result) => {
          queryClient.setQueryData(
            useDefaultLicenseQuery.getKey({}),
            {
              defaultLicense: result.setDefaultLicense,
            },
          );
          setDraft(undefined);
          setFormVersion((version) => version + 1);
          closeDialog();
          showSuccess('The default license was changed.');
        },
      },
    );
  };

  if (authLoading || (isAdmin && isLoading)) {
    return <LoadingSpinner label="Loading license..." />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-400">
        <p>
          You don't have permission to change the default license.
        </p>
      </div>
    );
  }

  if (error || !license) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-red-400">
        <p>Failed to fetch the default license</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-white">
        Default license
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        New novels get this license unless their author picks another.
        Existing novels keep theirs.
      </p>
      <div className="rounded-xl border border-gray-700/70 bg-gray-800 p-6">
        <LicenseField
          key={`${license.id}-${formVersion}`}
          license={license}
          disabled={setDefaultLicense.isPending}
          onDraftChange={setDraft}
        />
        <div className="mt-4 flex justify-end">
          <Button
            variant="solid"
            color="blue"
            disabled={!draft || draft.title.length === 0}
            onClick={() => setIsConfirming(true)}
          >
            Set as default
          </Button>
        </div>
      </div>

      {isConfirming && draft && (
        <ConfirmDialog
          title="Change the default license"
          message={`Every new novel without a chosen license will get "${draft.title}". Existing novels keep their license.`}
          confirmLabel="Change default"
          loadingLabel="Changing..."
          isLoading={setDefaultLicense.isPending}
          error={
            setDefaultLicense.error instanceof Error
              ? setDefaultLicense.error.message
              : null
          }
          onConfirm={handleConfirm}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
