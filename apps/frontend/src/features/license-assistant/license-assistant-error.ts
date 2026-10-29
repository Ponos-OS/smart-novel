import {
  CANONICAL_LICENSE_NOT_FOUND,
  CANONICAL_LICENSE_RETIRED,
  LICENSE_ASSISTANT_INVALID_REQUEST,
  LICENSE_ASSISTANT_RATE_LIMITED,
  LICENSE_ASSISTANT_UNAVAILABLE,
  PLATFORM_TERMS_NOT_ACCEPTED,
} from '@smart-novel/shared';

import type { MessageKey } from './messages';

import { GraphqlRequestError } from '../../lib/graphql-fetcher';

export type LicenseAssistantErrorKind =
  | 'terms-not-accepted'
  | 'rate-limited'
  | 'unavailable'
  | 'invalid-request'
  | 'license-not-found'
  | 'license-retired'
  | 'unknown';

export interface LicenseAssistantError {
  kind: LicenseAssistantErrorKind;
  /** @description What to tell the author; the component translates it. */
  messageKey: MessageKey;
  /** @description Fithara's correlation id, to quote to support. */
  requestId?: string;
  /** @description Only a retry can help; a request that was invalid or refused stays that way. */
  retryable: boolean;
}

const BY_CODE: Record<
  string,
  Pick<LicenseAssistantError, 'kind' | 'messageKey' | 'retryable'>
> = {
  [PLATFORM_TERMS_NOT_ACCEPTED]: {
    kind: 'terms-not-accepted',
    messageKey: 'error.termsNotAccepted',
    retryable: false,
  },
  [LICENSE_ASSISTANT_RATE_LIMITED]: {
    kind: 'rate-limited',
    messageKey: 'error.rateLimited',
    retryable: true,
  },
  [LICENSE_ASSISTANT_UNAVAILABLE]: {
    kind: 'unavailable',
    messageKey: 'error.unavailable',
    retryable: true,
  },
  [LICENSE_ASSISTANT_INVALID_REQUEST]: {
    kind: 'invalid-request',
    messageKey: 'error.invalidRequest',
    retryable: false,
  },
  BAD_REQUEST: {
    kind: 'invalid-request',
    messageKey: 'error.invalidRequest',
    retryable: false,
  },
  [CANONICAL_LICENSE_NOT_FOUND]: {
    kind: 'license-not-found',
    messageKey: 'error.licenseNotFound',
    retryable: false,
  },
  [CANONICAL_LICENSE_RETIRED]: {
    kind: 'license-retired',
    messageKey: 'error.licenseRetired',
    retryable: false,
  },
};

const UNKNOWN: LicenseAssistantError = {
  kind: 'unknown',
  messageKey: 'error.unknown',
  retryable: true,
};

/**
 * @description Maps what the backend answers to a state the assistant UI can render. Canonical ids and codes are language-independent; the sentence is a key into the messages, so it is shown in the language of the author.
 */
export function toLicenseAssistantError(
  error: unknown,
): LicenseAssistantError {
  if (!(error instanceof GraphqlRequestError)) {
    return UNKNOWN;
  }

  const code = error.extensions?.code;
  const mapped = typeof code === 'string' ? BY_CODE[code] : undefined;
  const requestId = error.extensions?.requestId;

  return {
    ...(mapped ?? UNKNOWN),
    requestId: typeof requestId === 'string' ? requestId : undefined,
  };
}
