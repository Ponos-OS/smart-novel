import { toUtcDay } from '@smart-novel/shared';

export interface StatSnapshot {
  day: string;
  value: number;
}

export interface StatPoint {
  time: string;
  value: number;
}

export interface StatSeries {
  /** @description Exact points, ascending, one per day */
  exact: StatPoint[];
  /** @description The estimate for today, which replaces today's snapshot */
  live: StatPoint | null;
}

function toDayKey(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * @description Days are `YYYY-MM-DD` because the chart wants unique, ascending business days. The live estimate is today's point, so a snapshot of today is dropped in its favor; without a live figure (its query failed) only the snapshots remain.
 */
export function buildStatSeries(
  snapshots: StatSnapshot[],
  liveValue: number | undefined,
  now: Date = new Date(),
): StatSeries {
  const today = toDayKey(toUtcDay(now));
  const live =
    liveValue === undefined
      ? null
      : { time: today, value: liveValue };
  const byDay = new Map(
    snapshots.map(({ day, value }) => [toDayKey(day), value]),
  );
  const exact = [...byDay]
    .filter(([time]) => !live || time !== today)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([time, value]) => ({ time, value }));

  return { exact, live };
}

export function countPoints({ exact, live }: StatSeries): number {
  return exact.length + (live ? 1 : 0);
}
