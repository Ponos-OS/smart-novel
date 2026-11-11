import { FitharaRequestError } from '../../../shared';
import { toGraphQLError } from './fithara-error.util';

describe(toGraphQLError.name, () => {
  it.each([
    ['INVALID_REQUEST', 400, 'LICENSE_ASSISTANT_INVALID_REQUEST'],
    ['RATE_LIMITED', 429, 'LICENSE_ASSISTANT_RATE_LIMITED'],
    ['UNKNOWN_LICENSE', 404, 'CANONICAL_LICENSE_NOT_FOUND'],
    ['LICENSE_INACTIVE', 410, 'CANONICAL_LICENSE_RETIRED'],
    ['LLM_UNAVAILABLE', 502, 'LICENSE_ASSISTANT_UNAVAILABLE'],
    ['LLM_INVALID_OUTPUT', 502, 'LICENSE_ASSISTANT_UNAVAILABLE'],
    ['INTERNAL', 502, 'LICENSE_ASSISTANT_UNAVAILABLE'],
    [undefined, 502, 'LICENSE_ASSISTANT_UNAVAILABLE'],
  ] as const)(
    'maps Fithara code %s to status %s and %s',
    (fitharaCode, status, code) => {
      // Arrange
      const error = new FitharaRequestError(
        'upstream detail',
        500,
        fitharaCode,
        '8f14e45f-ceea-467a-9575-1f3b5b0b3c0d',
      );

      // Act
      const result = toGraphQLError(error);

      // Assert
      expect(result.extensions).toEqual({
        code,
        status,
        requestId: '8f14e45f-ceea-467a-9575-1f3b5b0b3c0d',
      });
    },
  );

  it('hides the upstream message of an unavailable assistant', () => {
    // Arrange
    const error = new FitharaRequestError(
      'connect ECONNREFUSED 10.0.0.7',
    );

    // Act
    const result = toGraphQLError(error);

    // Assert
    expect(result.message).not.toInclude('ECONNREFUSED');
    expect(result.extensions['requestId']).toBeNull();
  });
});
