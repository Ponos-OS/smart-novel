import { useEffect, useState } from 'react';

import {
  type LicenseAssistantDraftInput,
  LicenseScope,
  LicenseSourceType,
  useSelectableLicensesQuery,
} from '../../generated/graphql';
import { nodesOf } from '../../lib/connection';
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
  /** @description Called with the draft to store, and with `undefined` when a license that is stored already is kept as it is. */
  onDraftChange: (
    draft: LicenseAssistantDraftInput | undefined,
  ) => void;
  /**
   * @description Called with the id of the stored license picked, a shared one or one of the writer's own, while one is picked and its text is left as it is, and with `undefined` otherwise. Like `onDraftChange`, it must be stable (a state setter).
   */
  onLicenseIdChange: (licenseId: string | undefined) => void;
  onDraftWithAssistant?: () => void;
}

const STORED_PREFIX = 'stored:';
const STORED_LICENSES_PAGE_SIZE = 100;

const INPUT_CLASSES =
  'w-full rounded-lg border px-3 py-2 disabled:opacity-50 border-gray-600 bg-gray-900 text-white';

/**
 * @description What to store for a text the writer changed: nothing while it is the base's own, a fork of the canonical license when the base is one, a custom license otherwise.
 */
function buildDraft(
  base: LicenseSummary,
  name: string,
  text: string,
): LicenseAssistantDraftInput | undefined {
  if (text === base.text) {
    return undefined;
  }

  const isFork = !!base.canonicalID;

  return {
    name,
    text,
    sourceType: isFork
      ? LicenseSourceType.Forked
      : LicenseSourceType.Custom,
    canonicalID: isFork ? base.canonicalID : undefined,
  };
}

export function LicenseField({
  license,
  disabled = false,
  onDraftChange,
  onLicenseIdChange,
  onDraftWithAssistant,
}: LicenseFieldProps) {
  const { data: sharedData } = useSelectableLicensesQuery({
    scope: LicenseScope.Shared,
    first: STORED_LICENSES_PAGE_SIZE,
  });
  const { data: personalData } = useSelectableLicensesQuery({
    scope: LicenseScope.Personal,
    first: STORED_LICENSES_PAGE_SIZE,
  });
  const toLicenses = (data: typeof sharedData): LicenseSummary[] =>
    nodesOf(data?.licenses ?? {}).filter(
      ({ id }) => id !== license.id,
    );
  const sharedLicenses = toLicenses(sharedData);
  const personalLicenses = toLicenses(personalData);
  const [picked, setPicked] = useState('');
  const pickedStored = [...sharedLicenses, ...personalLicenses].find(
    ({ id }) => `${STORED_PREFIX}${id}` === picked,
  );
  const base: LicenseSummary = pickedStored ?? license;

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
          value={picked}
          onChange={(event) => setPicked(event.target.value)}
          className={INPUT_CLASSES}
        >
          <option value="">Keep {license.name}</option>
          {sharedLicenses.length > 0 && (
            <optgroup label="Shared licenses">
              {sharedLicenses.map(({ id, name }) => (
                <option key={id} value={`${STORED_PREFIX}${id}`}>
                  {name}
                </option>
              ))}
            </optgroup>
          )}
          {personalLicenses.length > 0 && (
            <optgroup label="Your licenses">
              {personalLicenses.map(({ id, name }) => (
                <option key={id} value={`${STORED_PREFIX}${id}`}>
                  {name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <LicenseTextEditor
        key={base.id}
        base={base}
        storedId={pickedStored?.id}
        onDraftChange={onDraftChange}
        onLicenseIdChange={onLicenseIdChange}
      />
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
  storedId,
  onDraftChange,
  onLicenseIdChange,
}: {
  base: LicenseSummary;
  /** @description The stored license picked as the base: it is what the form sends while its text is left alone. */
  storedId?: string;
  onDraftChange: (
    draft: LicenseAssistantDraftInput | undefined,
  ) => void;
  onLicenseIdChange: (licenseId: string | undefined) => void;
}) {
  const [text, setText] = useState(base.text);
  const [title, setTitle] = useState('');
  const isModified = text !== base.text;

  const { id, name, canonicalID, text: baseText } = base;

  useEffect(() => {
    // The base may be rebuilt on every render, so only what it is made of may retrigger this.
    onDraftChange(undefined);
    onLicenseIdChange(storedId);
  }, [
    id,
    name,
    canonicalID,
    baseText,
    storedId,
    onDraftChange,
    onLicenseIdChange,
  ]);

  const handleChange = (nextText: string, nextTitle: string) => {
    const draft = buildDraft(base, nextTitle.trim(), nextText);

    setText(nextText);
    setTitle(nextTitle);
    onDraftChange(draft);
    onLicenseIdChange(draft ? undefined : storedId);
  };

  return (
    <>
      <p className="text-sm text-white">
        <strong>{base.name}</strong>
        <span className="block text-gray-300">
          {getLicenseNotice(base)}
        </span>
      </p>
      <OfficialLicenseLink officialUrl={base.officialURL} />
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
