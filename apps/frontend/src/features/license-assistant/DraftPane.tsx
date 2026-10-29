import type { LicenseDraftInput } from '../../generated/graphql';
import type { AssistantAnswerDetails } from './use-license-assistant';
import type { DraftSyncStatus } from './use-license-draft-autosave';

import { DisclaimerList } from './DisclaimerList';
import { DraftBody } from './DraftBody';
import { DraftSourceBadge } from './DraftSourceBadge';
import { FinalizeButton } from './FinalizeButton';
import { useMessages } from './i18n';
import { RecommendationChips } from './RecommendationChips';

interface DraftPaneProps {
  onPrefill: (message: string) => void;
  onViewLicense: (licenseId: string) => void;
  onFinalize: () => void;
  draft: LicenseDraftInput | null;
  details: AssistantAnswerDetails | null;
  isPending: boolean;
  isFinalizing: boolean;
  syncStatus: DraftSyncStatus;
}

/**
 * @description The draft stays on screen while the next answer is on its way, and is not rebuilt when the answer left it alone.
 */
export function DraftPane({
  draft,
  details,
  isPending,
  isFinalizing,
  syncStatus,
  onPrefill,
  onViewLicense,
  onFinalize,
}: DraftPaneProps) {
  const t = useMessages();
  const hasText = !!draft?.text.trim();
  const hasFailed = syncStatus === 'failed';

  return (
    <section
      aria-label={t('draft.title')}
      aria-busy={isPending}
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
        {t('draft.title')}
      </h2>
      {/* Only a failure is announced: "saving" and "saved" would interrupt a screen reader at every tick. */}
      <p
        role={hasFailed ? 'status' : undefined}
        className={`mb-3 text-xs ${
          hasFailed
            ? 'font-semibold text-red-600 dark:text-red-400'
            : 'text-gray-600 dark:text-gray-400'
        }`}
      >
        {t(`sync.${syncStatus}`)}
      </p>
      {draft && hasText ? (
        <>
          <DraftSourceBadge source={draft.source} />
          <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
            {draft.title}
          </h3>
          <DraftBody text={draft.text} />
        </>
      ) : (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('draft.empty')}
        </p>
      )}
      {details && (
        <p
          role="status"
          className="mt-3 text-xs text-gray-600 dark:text-gray-400"
        >
          {t(
            details.draftChanged
              ? 'draft.updated'
              : 'draft.unchanged',
          )}
        </p>
      )}
      {details && (
        <RecommendationChips
          recommendations={details.recommendations}
          onPrefill={onPrefill}
          onViewLicense={onViewLicense}
        />
      )}
      {details && (
        <DisclaimerList disclaimers={details.disclaimers} />
      )}
      <FinalizeButton
        canFinalize={hasText && !!draft?.title.trim()}
        isFinalizing={isFinalizing}
        isReadyToFinalize={!!details?.isReadyToFinalize}
        onFinalize={onFinalize}
      />
      <p className="mt-4 border-t border-gray-200 pt-3 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">
        {t('statement.notLegalAdvice')}
      </p>
    </section>
  );
}
