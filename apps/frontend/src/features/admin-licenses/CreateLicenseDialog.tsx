import { LICENSE_NAME_MAX_LENGTH } from '@smart-novel/shared';
import { useState } from 'react';

import { Dialog } from '../../components/Dialog';
import { DialogFormFooter } from '../../components/DialogFormFooter';
import {
  type LicenseDraftInput,
  LicenseSourceType,
  useCanonicalLicenseQuery,
  useCanonicalLicensesQuery,
  useCreateLicenseMutation,
} from '../../generated/graphql';
import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { showApiError, showSuccess } from '../../utils/notification';
import { LICENSE_DISCLAIMER } from '../novel-license/license-notice';
import { OfficialLicenseLink } from '../novel-license/OfficialLicenseLink';

interface CreateLicenseDialogProps {
  onCreated: () => void;
  onClose: () => void;
}

interface CanonicalBase {
  id: string;
  shortName: string;
  body: string;
  officialUrl: string;
}

const INPUT_CLASSES =
  'w-full rounded-lg border px-3 py-2 disabled:opacity-50 border-gray-600 bg-gray-900 text-white';

function getRefusalMessage(error: unknown): string | null {
  if (
    error instanceof GraphqlRequestError &&
    error.extensions?.code === 'BAD_REQUEST'
  ) {
    return error.message;
  }

  return null;
}

/**
 * @description The text of a canonical license, left alone, is that license; changed, it is a fork that needs its own name. Without a base the admin writes the license.
 */
function buildLicense(
  base: CanonicalBase | undefined,
  title: string,
  text: string,
): LicenseDraftInput | undefined {
  const name = title.trim();

  if (!base) {
    return name && text.trim()
      ? {
          title: name,
          text,
          source: { type: LicenseSourceType.Custom },
        }
      : undefined;
  }
  if (text === base.body) {
    return {
      title: base.shortName,
      text,
      source: {
        type: LicenseSourceType.Canonical,
        canonicalId: base.id,
      },
    };
  }

  return name && text.trim()
    ? {
        title: name,
        text,
        source: {
          type: LicenseSourceType.Forked,
          canonicalId: base.id,
        },
      }
    : undefined;
}

export function CreateLicenseDialog({
  onCreated,
  onClose,
}: CreateLicenseDialogProps) {
  const [pickedId, setPickedId] = useState('');
  const [title, setTitle] = useState('');
  const [editedText, setEditedText] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { data: listData } = useCanonicalLicensesQuery();
  const { data: detailData } = useCanonicalLicenseQuery(
    { id: pickedId },
    { enabled: !!pickedId },
  );
  const createLicense = useCreateLicenseMutation();
  const canonical = detailData?.canonicalLicense;
  const base =
    pickedId && canonical?.id === pickedId ? canonical : undefined;
  const isLoadingBase = !!pickedId && !base;
  const text = editedText ?? base?.body ?? '';
  const isModified = !!base && text !== base.body;
  const license = isLoadingBase
    ? undefined
    : buildLicense(base, title, text);
  const canSubmit = !!license && !createLicense.isPending;

  const handlePick = (id: string) => {
    setPickedId(id);
    setTitle('');
    setEditedText(null);
    setRefusal(null);
  };

  const handleSubmit = () => {
    if (!license || !canSubmit) {
      return;
    }

    setRefusal(null);
    createLicense.mutate(
      { input: license },
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
          Every writer can use the license for their novels. Add a
          canonical license as it is, change its text and name it, or
          write your own.
        </p>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">
            Start from
          </span>
          <select
            value={pickedId}
            disabled={createLicense.isPending}
            onChange={(event) => handlePick(event.target.value)}
            className={INPUT_CLASSES}
          >
            <option value="">Write your own</option>
            {listData?.canonicalLicenses.map((option) => (
              <option key={option.id} value={option.id}>
                {option.shortName}
              </option>
            ))}
          </select>
        </label>
        {isLoadingBase ? (
          <p role="status" className="text-sm text-gray-300">
            Loading the license...
          </p>
        ) : (
          <>
            {base && (
              <OfficialLicenseLink officialUrl={base.officialUrl} />
            )}
            {(!base || isModified) && (
              <label className="block">
                <span className="mb-1 block text-sm text-gray-300">
                  {base ? 'Name of your modified license' : 'Name'}
                </span>
                <input
                  type="text"
                  value={title}
                  maxLength={LICENSE_NAME_MAX_LENGTH}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={createLicense.isPending}
                  className={INPUT_CLASSES}
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-sm text-gray-300">
                License text
              </span>
              <textarea
                value={text}
                rows={10}
                onChange={(event) =>
                  setEditedText(event.target.value)
                }
                disabled={createLicense.isPending}
                className={INPUT_CLASSES}
              />
            </label>
          </>
        )}
        <p className="text-xs text-gray-400">{LICENSE_DISCLAIMER}</p>
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
