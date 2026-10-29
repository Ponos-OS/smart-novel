import { LicenseSourceType } from '@prisma/client';

import type { FitharaDraft } from '../../../shared';
import type { LicenseDraftInput } from '../../license';
import type { LicenseAssistantDraft } from '../types';

const SOURCE_TYPE_BY_FITHARA = {
  canonical: LicenseSourceType.CANONICAL,
  forked: LicenseSourceType.FORKED,
  custom: LicenseSourceType.CUSTOM,
} as const;

const FITHARA_SOURCE_TYPE = {
  [LicenseSourceType.CANONICAL]: 'canonical',
  [LicenseSourceType.FORKED]: 'forked',
  [LicenseSourceType.CUSTOM]: 'custom',
} as const;

export function toLicenseAssistantDraft(
  draft: FitharaDraft,
): LicenseAssistantDraft {
  return {
    title: draft.title,
    text: draft.text,
    source: {
      type: SOURCE_TYPE_BY_FITHARA[draft.source.type],
      canonicalId: draft.source.canonicalId ?? null,
    },
  };
}

export function toFitharaDraft(
  draft: LicenseDraftInput,
): FitharaDraft {
  return {
    title: draft.title,
    text: draft.text,
    source: {
      type: FITHARA_SOURCE_TYPE[draft.source.type],
      canonicalId: draft.source.canonicalId ?? null,
    },
  };
}
