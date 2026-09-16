import { GraphQLFormattedError } from 'graphql';

import { createGraphqlErrorFormatter } from './graphql-error-formatter';

function buildLogger() {
  return {
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe(createGraphqlErrorFormatter.name, () => {
  it('remaps extensions.code to CONFLICT and logs a warning for a 409 business exception', () => {
    // Arrange
    const logger = buildLogger();
    const formatError = createGraphqlErrorFormatter(logger as never);
    const formattedError: GraphQLFormattedError = {
      message:
        'This chapter was updated by someone else. Reload to get the latest version before saving.',
      path: ['updateContent'],
      extensions: { code: 'INTERNAL_SERVER_ERROR', status: 409 },
    };

    // Act
    const result = formatError(formattedError, new Error('boom'));

    // Assert
    expect(result.extensions?.code).toBe('CONFLICT');
    expect(logger.warn).toHaveBeenCalledWith(formattedError.message, {
      context: 'GraphQL',
      path: 'updateContent',
      status: 409,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('leaves extensions.code untouched for a status with no additional mapping (e.g. 403)', () => {
    // Arrange
    const logger = buildLogger();
    const formatError = createGraphqlErrorFormatter(logger as never);
    const formattedError: GraphQLFormattedError = {
      message: 'Forbidden',
      path: ['updateChapter'],
      extensions: { code: 'FORBIDDEN', status: 403 },
    };

    // Act
    const result = formatError(formattedError, new Error('boom'));

    // Assert
    expect(result.extensions?.code).toBe('FORBIDDEN');
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs an error with a stack trace for an unmapped/unexpected (5xx) failure', () => {
    // Arrange
    const logger = buildLogger();
    const formatError = createGraphqlErrorFormatter(logger as never);
    const formattedError: GraphQLFormattedError = {
      message: 'Something went wrong',
      path: ['generateChapterAudio'],
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    };
    const originalError = new Error('unexpected crash');

    // Act
    const result = formatError(formattedError, originalError);

    // Assert
    expect(result.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    expect(logger.error).toHaveBeenCalledWith(
      formattedError.message,
      {
        context: 'GraphQL',
        path: 'generateChapterAudio',
        status: 500,
        stack: originalError.stack,
      },
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
