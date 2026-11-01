import { useMemo, useState } from 'react';

import { Tooltip } from '../../components/Tooltip';
import {
  buildStatSeries,
  countPoints,
  type StatSnapshot,
} from './content-stat-series';
import { ContentStatChart } from './ContentStatChart';
import { formatEstimate } from './format-estimate';
import {
  STAT_RANGES,
  type StatRange,
  useStatsSnapshots,
} from './use-content-stats';

interface ContentStatCardProps {
  /** @description Plural noun the card counts, e.g. `novels` */
  noun: string;
  field: 'novelCount' | 'chapterCount';
  /** @description Today's estimate, `undefined` while it loads or when it failed */
  estimate: number | undefined;
  estimateFailed: boolean;
}

function pickSnapshots(
  snapshots: {
    day: string;
    novelCount: number;
    chapterCount: number;
  }[],
  field: ContentStatCardProps['field'],
): StatSnapshot[] {
  return snapshots.map((snapshot) => ({
    day: snapshot.day,
    value: snapshot[field],
  }));
}

export function ContentStatCard({
  noun,
  field,
  estimate,
  estimateFailed,
}: ContentStatCardProps) {
  const [range, setRange] = useState<StatRange>(30);
  const history = useStatsSnapshots(range);
  const series = useMemo(
    () =>
      buildStatSeries(
        pickSnapshots(history.snapshots ?? [], field),
        estimate,
      ),
    [history.snapshots, field, estimate],
  );
  const headline =
    estimate === undefined ? '–' : formatEstimate(estimate);
  const points = countPoints(series);
  const rows = [
    ...series.exact.map((point) => ({ ...point, estimated: false })),
    ...(series.live ? [{ ...series.live, estimated: true }] : []),
  ];
  const title = `${noun[0].toUpperCase()}${noun.slice(1)}`;

  return (
    <section
      aria-label={`${title} history`}
      className="rounded-lg border border-gray-700 bg-gray-800 p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-gray-300">
            {title}
          </h2>
          <Tooltip content="A database estimate, not an exact count. It is as fresh as the last statistics update.">
            <span
              tabIndex={0}
              aria-label={
                estimate === undefined
                  ? `${title}: no figure available`
                  : `About ${estimate.toLocaleString('en')} ${noun}, a database estimate`
              }
              className="mt-1 block cursor-help text-3xl font-semibold text-white"
            >
              {headline}
            </span>
          </Tooltip>
          {estimateFailed && (
            <p className="mt-1 text-xs text-red-400">
              Today's figure could not be loaded.
            </p>
          )}
        </div>
        <div
          role="group"
          aria-label={`${title} history range`}
          className="flex gap-1"
        >
          {STAT_RANGES.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={range === days}
              onClick={() => setRange(days)}
              className={`cursor-pointer rounded px-2 py-1 text-xs transition-colors ${
                range === days
                  ? 'bg-blue-900 text-blue-100'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      {history.isLoading && (
        <div
          role="status"
          aria-label={`Loading the ${noun} history`}
          className="h-44 animate-pulse rounded bg-gray-700"
        />
      )}
      {history.isError && (
        <p
          role="alert"
          className="py-8 text-center text-sm text-red-400"
        >
          The {noun} history could not be loaded.
        </p>
      )}
      {!history.isLoading && !history.isError && points <= 1 && (
        <p className="py-8 text-center text-sm text-gray-400">
          The history builds up daily.
        </p>
      )}
      {!history.isLoading && !history.isError && points > 1 && (
        <>
          <ContentStatChart
            series={series}
            label={`${title} over the last ${range} days`}
          />
          {series.live && (
            <p className="mt-1 text-xs text-gray-400">
              The dashed line is today's estimate; the days before it
              are exact.
            </p>
          )}
          <details className="mt-3 text-sm text-gray-300">
            <summary className="cursor-pointer text-xs text-gray-400">
              Show the values as a table
            </summary>
            <table className="mt-2 w-full text-left text-xs">
              <caption className="sr-only">{title} per day</caption>
              <thead>
                <tr className="text-gray-400">
                  <th scope="col" className="py-1 font-medium">
                    Day
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    {title}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.time}>
                    <th scope="row" className="py-0.5 font-normal">
                      {row.time}
                    </th>
                    <td className="py-0.5">
                      {row.estimated
                        ? `${formatEstimate(row.value)} (estimate)`
                        : row.value.toLocaleString('en')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
