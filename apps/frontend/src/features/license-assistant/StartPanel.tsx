import type { Ref } from 'react';

import { Button } from '../../components/Button';
import {
  type CreateLicenseDraftInput,
  type LicenseDraftFieldsFragment,
  useLicenseDraftsQuery,
} from '../../generated/graphql';
import { useMessages } from './i18n';

interface StartPanelProps {
  /** @description Lets the workspace move the focus here when the writer comes back from a draft. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** @description The license of the novel being edited, to customize it. */
  baseLicense?: { id: string; name: string };
  isCreating: boolean;
  error: string | null;
  onCreate: (input: CreateLicenseDraftInput) => void;
  onResume: (draft: LicenseDraftFieldsFragment) => void;
  onDiscard: (id: string) => void;
}

export function StartPanel({
  headingRef,
  baseLicense,
  isCreating,
  error,
  onCreate,
  onResume,
  onDiscard,
}: StartPanelProps) {
  const t = useMessages();
  const { data } = useLicenseDraftsQuery();
  const drafts =
    data?.licenseDraftsConnection.edges.map(({ node }) => node) ?? [];

  return (
    <section
      aria-label={t('start.title')}
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mb-3 outline-none text-lg font-bold text-gray-900 dark:text-white"
      >
        {t('start.title')}
      </h2>
      <div className="flex flex-wrap gap-3">
        {baseLicense && (
          <Button
            type="button"
            variant="solid"
            color="blue"
            disabled={isCreating}
            onClick={() => onCreate({ licenseId: baseLicense.id })}
          >
            {t('start.customize', { name: baseLicense.name })}
          </Button>
        )}
        <Button
          type="button"
          variant={baseLicense ? 'outline' : 'solid'}
          color={baseLicense ? 'gray' : 'blue'}
          disabled={isCreating}
          onClick={() => onCreate({})}
        >
          {t('start.writeOwn')}
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
      {drafts.length > 0 && (
        <section aria-label={t('start.unfinished')} className="mt-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            {t('start.unfinished')}
          </h3>
          <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-700">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex items-center justify-between gap-3 py-2 text-sm text-gray-800 dark:text-gray-200"
              >
                <span>
                  <strong>
                    {draft.title || t('start.untitled')}
                  </strong>
                  <span className="block text-xs text-gray-600 dark:text-gray-400">
                    {t('start.saved', {
                      date: new Date(
                        draft.updatedAt,
                      ).toLocaleString(),
                    })}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    variant="chip"
                    color="blue"
                    onClick={() => onResume(draft)}
                  >
                    {t('start.continue', {
                      title: draft.title || t('start.untitled'),
                    })}
                  </Button>
                  <Button
                    type="button"
                    variant="chip"
                    color="red"
                    onClick={() => onDiscard(draft.id)}
                  >
                    {t('start.discard', {
                      title: draft.title || t('start.untitled'),
                    })}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
