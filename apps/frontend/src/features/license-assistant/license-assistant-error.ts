import {
  CANONICAL_LICENSE_NOT_FOUND,
  CANONICAL_LICENSE_RETIRED,
  LICENSE_ASSISTANT_INVALID_REQUEST,
  LICENSE_ASSISTANT_RATE_LIMITED,
  LICENSE_ASSISTANT_UNAVAILABLE,
  PLATFORM_TERMS_NOT_ACCEPTED,
} from '@smart-novel/shared';

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
  message: string;
  /** @description Fithara's correlation id, to quote to support. */
  requestId?: string;
  /** @description Only a retry can help; a request that was invalid or refused stays that way. */
  retryable: boolean;
}

const BY_CODE: Record<
  string,
  Pick<LicenseAssistantError, 'kind' | 'message' | 'retryable'>
> = {
  [PLATFORM_TERMS_NOT_ACCEPTED]: {
    kind: 'terms-not-accepted',
    message: 'Accept the platform terms to use the assistant.',
    retryable: false,
  },
  [LICENSE_ASSISTANT_RATE_LIMITED]: {
    kind: 'rate-limited',
    message:
      'You sent too many messages to the assistant. Try again in a while.',
    retryable: true,
  },
  [LICENSE_ASSISTANT_UNAVAILABLE]: {
    kind: 'unavailable',
    message:
      'The assistant is not available right now. Your conversation and draft are kept; try again later.',
    retryable: true,
  },
  [LICENSE_ASSISTANT_INVALID_REQUEST]: {
    kind: 'invalid-request',
    message:
      'The assistant could not take that message. Shorten it, or the draft, and try again.',
    retryable: false,
  },
  BAD_REQUEST: {
    kind: 'invalid-request',
    message:
      'The assistant could not take that message. Shorten it, or the draft, and try again.',
    retryable: false,
  },
  [CANONICAL_LICENSE_NOT_FOUND]: {
    kind: 'license-not-found',
    message: 'That license is not in the list of canonical licenses.',
    retryable: false,
  },
  [CANONICAL_LICENSE_RETIRED]: {
    kind: 'license-retired',
    message:
      'That license is no longer offered for new drafts. Pick another one.',
    retryable: false,
  },
};

const UNKNOWN: LicenseAssistantError = {
  kind: 'unknown',
  message: 'Something went wrong. Try again later.',
  retryable: true,
};

/**
 * @description Maps what the backend answers to a state the assistant UI can render. Canonical ids and codes are language-independent; the messages are plain strings for now.
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
