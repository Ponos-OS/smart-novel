import { toUtcDay } from './utc-day';

describe(toUtcDay.name, () => {
  it.each([
    ['the start of a UTC day', '2026-11-01T00:00:00.000Z'],
    ['the middle of a UTC day', '2026-11-01T13:45:10.000Z'],
    ['the last millisecond of a UTC day', '2026-11-01T23:59:59.999Z'],
  ])('should give that day at midnight for %s', (_name, input) => {
    const result = toUtcDay(new Date(input));

    expect(result).toEqual(new Date('2026-11-01T00:00:00.000Z'));
  });

  it('should use the UTC day, not the day of the offset', () => {
    const result = toUtcDay(
      new Date('2026-11-01T23:30:00.000-05:00'),
    );

    expect(result).toEqual(new Date('2026-11-02T00:00:00.000Z'));
  });
});
