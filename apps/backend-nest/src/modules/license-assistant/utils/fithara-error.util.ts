import { HttpStatus } from '@nestjs/common';
import {
  CANONICAL_LICENSE_NOT_FOUND,
  CANONICAL_LICENSE_RETIRED,
  LICENSE_ASSISTANT_INVALID_REQUEST,
  LICENSE_ASSISTANT_RATE_LIMITED,
  LICENSE_ASSISTANT_UNAVAILABLE,
} from '@smart-novel/shared';
import { GraphQLError } from 'graphql';

import { FitharaRequestError } from '../../../shared';

const ERROR_BY_FITHARA_CODE = {
  INVALID_REQUEST: {
    code: LICENSE_ASSISTANT_INVALID_REQUEST,
    status: HttpStatus.BAD_REQUEST,
  },
  RATE_LIMITED: {
    code: LICENSE_ASSISTANT_RATE_LIMITED,
    status: HttpStatus.TOO_MANY_REQUESTS,
  },
  UNKNOWN_LICENSE: {
    code: CANONICAL_LICENSE_NOT_FOUND,
    status: HttpStatus.NOT_FOUND,
  },
  LICENSE_INACTIVE: {
    code: CANONICAL_LICENSE_RETIRED,
    status: HttpStatus.GONE,
  },
} as const;

const UNAVAILABLE = {
  code: LICENSE_ASSISTANT_UNAVAILABLE,
  status: HttpStatus.BAD_GATEWAY,
};

/**
 * @description Fithara's own failures (LLM down, invalid LLM output, internal) are all "unavailable" for the caller; its `requestId` travels along for support.
 */
export function toGraphQLError(
  error: FitharaRequestError,
): GraphQLError {
  const { code, status } =
    (error.code &&
      ERROR_BY_FITHARA_CODE[
        error.code as keyof typeof ERROR_BY_FITHARA_CODE
      ]) ||
    UNAVAILABLE;
  const message =
    code === LICENSE_ASSISTANT_UNAVAILABLE
      ? 'The license assistant is not available right now. Try again later.'
      : error.message;

  return new GraphQLError(message, {
    extensions: { code, status, requestId: error.requestId ?? null },
  });
}
