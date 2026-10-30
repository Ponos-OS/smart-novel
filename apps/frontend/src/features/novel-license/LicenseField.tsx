import { useEffect, useState } from 'react';

import {
  type LicenseDraftInput,
  LicenseSourceType,
  useCanonicalLicenseQuery,
  useCanonicalLicensesQuery,
} from '../../generated/graphql';
import {
  getLicenseNotice,
  LICENSE_DISCLAIMER,
  type LicenseSummary,
} from './license-notice';
import { OfficialLicenseLink } from './OfficialLicenseLink';

interface LicenseFieldProps {
  /** @description The license the novel has or will get. */
  license: LicenseSummary;
  disabled?: boolean;
  /** @description Called with the draft to save, and with `undefined` when the license in use is kept as it is. */
  onDraftChange: (draft: LicenseDraftInput | undefined) => void;
  onDraftWithAssistant?: () => void;
}

interface LicenseBase extends LicenseSummary {
  /** @description Already a row of the licenses table. A canonical license of the registry is not until a novel uses it. */
  isStored: boolean;
}

const INPUT_CLASSES =
  'w-full rounded-lg border px-3 py-2 disabled:opacity-50 border-gray-600 bg-gray-900 text-white';

function buildDraft(
  base: LicenseBase,
  title: string,
  text: string,
): LicenseDraftInput | undefined {
  if (text === base.text) {
    return base.isStored
      ? undefined
      : {
          title: base.name,
          text,
          source: {
            type: LicenseSourceType.Canonical,
            canonicalId: base.canonicalId,
          },
        };
  }

  const isFork = !!base.canonicalId;

  return {
    title,
    text,
    source: {
      type: isFork
        ? LicenseSourceType.Forked
        : LicenseSourceType.Custom,
      canonicalId: isFork ? base.canonicalId : undefined,
    },
  };
}

export function LicenseField({
  license,
  disabled = false,
  onDraftChange,
  onDraftWithAssistant,
}: LicenseFieldProps) {
  const [pickedId, setPickedId] = useState('');
  const { data: listData } = useCanonicalLicensesQuery();
  const { data: detailData } = useCanonicalLicenseQuery(
    { id: pickedId },
    { enabled: !!pickedId },
  );
  const detail = detailData?.canonicalLicense;
  const isLoadingPick = !!pickedId && detail?.id !== pickedId;

  useEffect(() => {
    if (isLoadingPick) {
      // An empty name keeps the form from saving while the picked license is still being fetched.
      onDraftChange({
        title: '',
        text: '',
        source: { type: LicenseSourceType.Canonical },
      });
    }
  }, [isLoadingPick, onDraftChange]);

  const base: LicenseBase =
    pickedId && detail?.id === pickedId
      ? {
          id: detail.id,
          name: detail.shortName,
          sourceType: LicenseSourceType.Canonical,
          canonicalId: detail.id,
          officialUrl: detail.officialUrl,
          text: detail.body,
          isStored: false,
        }
      : { ...license, isStored: true };

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium text-gray-300">
        License
      </legend>
      <label className="block">
        <span className="mb-1 block text-sm text-gray-300">
          Start from
        </span>
        <select
          value={pickedId}
          onChange={(event) => setPickedId(event.target.value)}
          className={INPUT_CLASSES}
        >
          <option value="">Keep {license.name}</option>
          {listData?.canonicalLicenses.map((canonical) => (
            <option key={canonical.id} value={canonical.id}>
              {canonical.shortName}
            </option>
          ))}
        </select>
      </label>
      {isLoadingPick ? (
        <p role="status" className="text-sm text-gray-300">
          Loading the license...
        </p>
      ) : (
        <LicenseTextEditor
          key={base.id}
          base={base}
          onDraftChange={onDraftChange}
        />
      )}
      {onDraftWithAssistant && (
        <button
          type="button"
          className="cursor-pointer text-sm font-medium text-blue-400"
          onClick={onDraftWithAssistant}
        >
          Draft with assistant
        </button>
      )}
      <p className="text-xs text-gray-400">{LICENSE_DISCLAIMER}</p>
    </fieldset>
  );
}

function LicenseTextEditor({
  base,
  onDraftChange,
}: {
  base: LicenseBase;
  onDraftChange: (draft: LicenseDraftInput | undefined) => void;
}) {
  const [text, setText] = useState(base.text);
  const [title, setTitle] = useState('');
  const isModified = text !== base.text;

  const { id, name, canonicalId, text: baseText, isStored } = base;

  useEffect(() => {
    // The base is rebuilt on every render, so only what it is made of may retrigger this.
    onDraftChange(
      buildDraft(
        {
          id,
          name,
          canonicalId,
          text: baseText,
          isStored,
        } as LicenseBase,
        '',
        baseText,
      ),
    );
  }, [id, name, canonicalId, baseText, isStored, onDraftChange]);

  const handleChange = (nextText: string, nextTitle: string) => {
    setText(nextText);
    setTitle(nextTitle);
    onDraftChange(buildDraft(base, nextTitle.trim(), nextText));
  };

  return (
    <>
      <p className="text-sm text-white">
        <strong>{base.name}</strong>
        <span className="block text-gray-300">
          {getLicenseNotice(base)}
        </span>
      </p>
      <OfficialLicenseLink officialUrl={base.officialUrl} />
      <details>
        <summary className="cursor-pointer text-sm font-medium text-blue-400">
          Read and edit the license text
        </summary>
        <label className="mt-2 block">
          <span className="mb-1 block text-sm text-gray-300">
            License text
          </span>
          <textarea
            value={text}
            onChange={(event) =>
              handleChange(event.target.value, title)
            }
            rows={10}
            className={INPUT_CLASSES}
          />
        </label>
        <button
          type="button"
          className="mt-1 cursor-pointer text-sm disabled:opacity-50 text-blue-400"
          disabled={!isModified}
          onClick={() => handleChange(base.text, '')}
        >
          Reset to {base.name}
        </button>
      </details>
      {isModified && (
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">
            Name of your modified license
          </span>
          <input
            type="text"
            value={title}
            onChange={(event) =>
              handleChange(text, event.target.value)
            }
            required
            className={INPUT_CLASSES}
          />
        </label>
      )}
    </>
  );
}
