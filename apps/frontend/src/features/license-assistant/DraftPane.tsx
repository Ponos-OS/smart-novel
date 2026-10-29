import type { LicenseDraftInput } from '../../generated/graphql';
import type { AssistantAnswerDetails } from './use-license-assistant';

import { LICENSE_DISCLAIMER } from '../novel-license/license-notice';
import { DisclaimerList } from './DisclaimerList';
import { DraftBody } from './DraftBody';
import { DraftSourceBadge } from './DraftSourceBadge';

interface DraftPaneProps {
  draft: LicenseDraftInput | null;
  details: AssistantAnswerDetails | null;
  isPending: boolean;
}

/**
 * @description The draft stays on screen while the next answer is on its way, and is not rebuilt when the answer left it alone.
 */
export function DraftPane({
  draft,
  details,
  isPending,
}: DraftPaneProps) {
  return (
    <section
      aria-label="Draft license"
      aria-busy={isPending}
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">
        Draft license
      </h2>
      {draft ? (
        <>
          <DraftSourceBadge source={draft.source} />
          <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
            {draft.title}
          </h3>
          <DraftBody text={draft.text} />
        </>
      ) : (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          No draft yet. Tell the assistant what you want, and it will
          propose one here.
        </p>
      )}
      {details && (
        <p
          role="status"
          className="mt-3 text-xs text-gray-600 dark:text-gray-400"
        >
          {details.draftChanged
            ? 'The assistant updated the draft.'
            : 'The draft did not change in this answer.'}
        </p>
      )}
      {details && (
        <DisclaimerList disclaimers={details.disclaimers} />
      )}
      <p className="mt-4 border-t border-gray-200 pt-3 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">
        {LICENSE_DISCLAIMER}
      </p>
    </section>
  );
}
