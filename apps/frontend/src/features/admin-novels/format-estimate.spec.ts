import { formatEstimate } from './format-estimate';

describe(formatEstimate.name, () => {
  it.each([
    [0, '~0'],
    [400, '~400'],
    [1204, '~1.2k'],
    [14000, '~14k'],
    [14231, '~14.2k'],
    [2500000, '~2.5M'],
  ])('should write %i as %s', (count, expected) => {
    const result = formatEstimate(count);

    expect(result).toBe(expected);
  });
});
