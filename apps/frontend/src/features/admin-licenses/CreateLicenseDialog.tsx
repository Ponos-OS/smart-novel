import { useState } from 'react';

import { Dialog } from '../../components/Dialog';
import { DialogFormFooter } from '../../components/DialogFormFooter';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  type LicenseDraftInput,
  useCreateLicenseMutation,
  useDefaultLicenseQuery,
} from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { LicenseField } from '../novel-license/LicenseField';

interface CreateLicenseDialogProps {
  onCreated: () => void;
  onClose: () => void;
}

function getRefusalMessage(error: unknown): string | null {
  if (
    error instanceof GraphqlRequestError &&
    error.extensions?.code === 'BAD_REQUEST'
  ) {
    return error.message;
  }

  return null;
}

export function CreateLicenseDialog({
  onCreated,
  onClose,
}: CreateLicenseDialogProps) {
  const { data, isLoading } = useDefaultLicenseQuery();
  const [draft, setDraft] = useState<LicenseDraftInput>();
  const [refusal, setRefusal] = useState<string | null>(null);
  const createLicense = useCreateLicenseMutation();
  const canSubmit =
    !!draft && draft.title.length > 0 && !createLicense.isPending;

  const handleSubmit = () => {
    if (!draft || !canSubmit) {
      return;
    }

    setRefusal(null);
    createLicense.mutate(
      { input: draft },
      {
        onSuccess: ({ createLicense: created }) => {
          showSuccess(`"${created.name}" was created.`);
          onCreated();
        },
        onError: (error) => {
          const message = getRefusalMessage(error);

          if (message) {
            setRefusal(message);
            return;
          }

          showApiError();
        },
      },
    );
  };

  return (
    <Dialog title="Create a license" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <p className="text-sm text-gray-300">
          Every writer can use the license for their novels. Pick a
          canonical license to add it as it is, or change its text and
          name it.
        </p>
        {isLoading || !data ? (
          <LoadingSpinner label="Loading..." />
        ) : (
          <LicenseField
            license={data.defaultLicense}
            disabled={createLicense.isPending}
            onDraftChange={setDraft}
          />
        )}
        <DialogFormFooter
          refusal={refusal}
          refusalId="create-license-error"
          isPending={createLicense.isPending}
          submitLabel="Create license"
          submitDisabled={!canSubmit}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
