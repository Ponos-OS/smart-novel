import { getAutosaveIntervalMs } from './autosave-interval';

describe(getAutosaveIntervalMs.name, () => {
  it.each([
    ['5', 5000],
    ['12', 12000],
    ['0.5', 500],
  ])('turns %s seconds into %s milliseconds', (seconds, expected) => {
    // Act
    const result = getAutosaveIntervalMs(seconds);

    // Assert
    expect(result).toBe(expected);
  });

  it.each([undefined, '', 'soon', '0', '-3', 'Infinity'])(
    'falls back to 5 seconds for %j',
    (value) => {
      // Act
      const result = getAutosaveIntervalMs(value);

      // Assert
      expect(result).toBe(5000);
    },
  );
});
