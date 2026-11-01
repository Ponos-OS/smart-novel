import { buildStatSeries, countPoints } from './content-stat-series';

const now = new Date('2026-11-01T15:20:00.000Z');
const snapshot = (day: string, value: number) => ({
  day: `${day}T00:00:00.000Z`,
  value,
});

describe(buildStatSeries.name, () => {
  it('should keep the snapshots ascending and add the live point as today', () => {
    const result = buildStatSeries(
      [snapshot('2026-10-31', 1198), snapshot('2026-10-30', 1190)],
      1204,
      now,
    );

    expect(result).toEqual({
      exact: [
        { time: '2026-10-30', value: 1190 },
        { time: '2026-10-31', value: 1198 },
      ],
      live: { time: '2026-11-01', value: 1204 },
    });
  });

  it("should replace today's snapshot with the live point", () => {
    const result = buildStatSeries(
      [snapshot('2026-10-31', 1198), snapshot('2026-11-01', 1200)],
      1204,
      now,
    );

    expect(result.exact).toEqual([
      { time: '2026-10-31', value: 1198 },
    ]);
    expect(result.live).toEqual({ time: '2026-11-01', value: 1204 });
  });

  it("should keep today's snapshot when there is no live figure", () => {
    const result = buildStatSeries(
      [snapshot('2026-11-01', 1200)],
      undefined,
      now,
    );

    expect(result).toEqual({
      exact: [{ time: '2026-11-01', value: 1200 }],
      live: null,
    });
  });

  it('should use the UTC day of now, not the local one', () => {
    const result = buildStatSeries(
      [],
      5,
      new Date('2026-11-01T23:30:00.000-05:00'),
    );

    expect(result.live).toEqual({ time: '2026-11-02', value: 5 });
  });

  it('should give nothing for no snapshots and no live figure', () => {
    const result = buildStatSeries([], undefined, now);

    expect(result).toEqual({ exact: [], live: null });
  });
});

describe(countPoints.name, () => {
  it.each([
    ['nothing', { exact: [], live: null }, 0],
    [
      'the live point alone',
      { exact: [], live: { time: '2026-11-01', value: 5 } },
      1,
    ],
    [
      'snapshots and the live point',
      {
        exact: [{ time: '2026-10-31', value: 4 }],
        live: { time: '2026-11-01', value: 5 },
      },
      2,
    ],
  ])('should count %s', (_name, series, expected) => {
    const result = countPoints(series);

    expect(result).toBe(expected);
  });
});
