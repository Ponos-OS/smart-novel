import { GraphqlRequestError } from '../../lib/graphql-fetcher';
import { toLicenseAssistantError } from './license-assistant-error';

describe(toLicenseAssistantError.name, () => {
  it.each([
    ['PLATFORM_TERMS_NOT_ACCEPTED', 'terms-not-accepted', false],
    ['LICENSE_ASSISTANT_RATE_LIMITED', 'rate-limited', true],
    ['LICENSE_ASSISTANT_UNAVAILABLE', 'unavailable', true],
    ['LICENSE_ASSISTANT_INVALID_REQUEST', 'invalid-request', false],
    ['BAD_REQUEST', 'invalid-request', false],
    ['CANONICAL_LICENSE_NOT_FOUND', 'license-not-found', false],
    ['CANONICAL_LICENSE_RETIRED', 'license-retired', false],
    ['SOMETHING_NEW', 'unknown', true],
  ])(
    'maps the code %s to %s (retryable: %s)',
    (code, kind, retryable) => {
      // Arrange
      const error = new GraphqlRequestError('upstream detail', {
        code,
      });

      // Act
      const result = toLicenseAssistantError(error);

      // Assert
      expect(result).toMatchObject({ kind, retryable });
      expect(result.message).not.toBe('upstream detail');
    },
  );

  it('passes the request id along so the author can quote it to support', () => {
    // Arrange
    const error = new GraphqlRequestError('unavailable', {
      code: 'LICENSE_ASSISTANT_UNAVAILABLE',
      requestId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    });

    // Act
    const result = toLicenseAssistantError(error);

    // Assert
    expect(result.requestId).toBe(
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    );
  });

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['an error without extensions', new GraphqlRequestError('boom')],
    ['something thrown that is not an error', 'oops'],
  ])('treats %s as unknown', (_scenario, error) => {
    // Act
    const result = toLicenseAssistantError(error);

    // Assert
    expect(result).toMatchObject({
      kind: 'unknown',
      retryable: true,
    });
    expect(result.requestId).toBeUndefined();
  });
});
