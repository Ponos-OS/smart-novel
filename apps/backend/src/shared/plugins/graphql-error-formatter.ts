import { unwrapResolverError } from '@apollo/server/errors';
import { HttpStatus } from '@nestjs/common';
import { GraphQLFormattedError } from 'graphql';
import { CustomLoggerService } from 'nestjs-backend-common';

const GENERIC_CODE = 'INTERNAL_SERVER_ERROR';

/** @description custom error codes sent by the backend */
const ADDITIONAL_STATUS_CODES: Partial<Record<number, string>> = {
  [HttpStatus.CONFLICT]: 'CONFLICT',
};

/**
 * @description Builds Apollo Server's `formatError` hook: logs every GraphQL error
 */
export function createGraphqlErrorFormatter(
  logger: CustomLoggerService,
) {
  return (
    formattedError: GraphQLFormattedError,
    error: unknown,
  ): GraphQLFormattedError => {
    const status = formattedError.extensions?.status as
      | number
      | undefined;
    const isKnownClientError =
      typeof status === 'number' &&
      status < HttpStatus.INTERNAL_SERVER_ERROR;
    const logMeta = {
      context: 'GraphQL',
      path: formattedError.path?.join('.'),
      status: status ?? HttpStatus.INTERNAL_SERVER_ERROR,
    };

    if (isKnownClientError) {
      logger.warn(formattedError.message, logMeta);
    } else {
      const originalError = unwrapResolverError(error);
      logger.error(formattedError.message, {
        ...logMeta,
        stack:
          originalError instanceof Error
            ? originalError.stack
            : undefined,
      });
    }

    // A code the thrower chose (e.g. PEN_NAME_TAKEN on a 409) is more specific than the status and stays.
    const remappedCode =
      status && formattedError.extensions?.code === GENERIC_CODE
        ? ADDITIONAL_STATUS_CODES[status]
        : undefined;

    if (!remappedCode) {
      return formattedError;
    }

    return {
      ...formattedError,
      extensions: {
        ...formattedError.extensions,
        code: remappedCode,
      },
    };
  };
}
