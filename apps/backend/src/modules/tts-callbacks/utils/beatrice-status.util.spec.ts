import {
  isBeatriceTerminal,
  isBeatriceTerminalFailure,
  isBeatriceTerminalSuccess,
  isKnownBeatriceStatus,
} from './beatrice-status.util';

describe(isBeatriceTerminalSuccess.name, () => {
  it.each(['completed', 'failed', 'queued', 'transcoding'])(
    'should return %s === "completed" for status "%s"',
    (status) => {
      const result = isBeatriceTerminalSuccess(status);

      expect(result).toBe(status === 'completed');
    },
  );
});

describe(isBeatriceTerminalFailure.name, () => {
  it.each(['completed', 'failed', 'generating', 'transcoding'])(
    'should return %s === "failed" for status "%s"',
    (status) => {
      const result = isBeatriceTerminalFailure(status);

      expect(result).toBe(status === 'failed');
    },
  );
});

describe(isBeatriceTerminal.name, () => {
  it.each([
    ['completed', true],
    ['failed', true],
    ['queued', false],
    ['generating', false],
    ['uploading', false],
    ['transcoding', false],
  ])('should return %s for status "%s"', (status, expected) => {
    const result = isBeatriceTerminal(status);

    expect(result).toBe(expected);
  });
});

describe(isKnownBeatriceStatus.name, () => {
  it.each([
    ['queued', true],
    ['generating', true],
    ['uploading', true],
    ['completed', true],
    ['failed', true],
    ['transcoding', false],
    ['succeeded', false],
  ])('should return %s for status "%s"', (status, expected) => {
    const result = isKnownBeatriceStatus(status);

    expect(result).toBe(expected);
  });
});
