import { useState } from 'react';

import {
  type LicenseDraftInput,
  LicenseSourceType,
} from '../../generated/graphql';
import {
  getLicenseNotice,
  LICENSE_DISCLAIMER,
  type LicenseSummary,
} from './license-notice';

interface LicenseFieldProps {
  license: LicenseSummary;
  disabled?: boolean;
  /** @description Called with the draft when the text was changed, and with `undefined` when it matches the license again. */
  onDraftChange: (draft: LicenseDraftInput | undefined) => void;
  onDraftWithAssistant?: () => void;
}

const INPUT_CLASSES =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white';

function buildDraft(
  license: LicenseSummary,
  title: string,
  text: string,
): LicenseDraftInput {
  const isFork = !!license.canonicalId;

  return {
    title,
    text,
    source: {
      type: isFork
        ? LicenseSourceType.Forked
        : LicenseSourceType.Custom,
      canonicalId: isFork ? license.canonicalId : undefined,
    },
  };
}

export function LicenseField({
  license,
  disabled = false,
  onDraftChange,
  onDraftWithAssistant,
}: LicenseFieldProps) {
  const [text, setText] = useState(license.text);
  const [title, setTitle] = useState('');
  const isModified = text !== license.text;

  const handleChange = (nextText: string, nextTitle: string) => {
    setText(nextText);
    setTitle(nextTitle);
    onDraftChange(
      nextText === license.text
        ? undefined
        : buildDraft(license, nextTitle.trim(), nextText),
    );
  };

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        License
      </legend>
      <p className="text-sm text-gray-900 dark:text-white">
        <strong>{license.name}</strong>
        <span className="block text-gray-700 dark:text-gray-300">
          {getLicenseNotice(license)}
        </span>
      </p>
      <details>
        <summary className="cursor-pointer text-sm font-medium text-blue-600 dark:text-blue-400">
          Read and edit the license text
        </summary>
        <label className="mt-2 block">
          <span className="mb-1 block text-sm text-gray-700 dark:text-gray-300">
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
          className="mt-1 cursor-pointer text-sm text-blue-600 disabled:opacity-50 dark:text-blue-400"
          disabled={!isModified}
          onClick={() => handleChange(license.text, '')}
        >
          Reset to {license.name}
        </button>
      </details>
      {isModified && (
        <label className="block">
          <span className="mb-1 block text-sm text-gray-700 dark:text-gray-300">
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
      {onDraftWithAssistant && (
        <button
          type="button"
          className="cursor-pointer text-sm font-medium text-blue-600 dark:text-blue-400"
          onClick={onDraftWithAssistant}
        >
          Draft with assistant
        </button>
      )}
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {LICENSE_DISCLAIMER}
      </p>
    </fieldset>
  );
}
