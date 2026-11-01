import {
  WRITER_INTEGRITY_ERROR,
  writerIntegrityError,
} from './writer-integrity';

describe(writerIntegrityError.name, () => {
  it('should log an error that starts with the stable text and return it to throw', () => {
    const logger = { error: vi.fn() };

    const result = writerIntegrityError(
      logger as never,
      'novel c1d31ec2 references writer 5b2c0f3e that does not exist',
    );

    expect(result.message).toStartWith(WRITER_INTEGRITY_ERROR);
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      result.message,
    );
  });
});
