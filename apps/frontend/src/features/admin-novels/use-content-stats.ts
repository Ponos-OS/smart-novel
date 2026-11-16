import {
  useContentStatsQuery,
  useStatsSnapshotsQuery,
} from '../../generated/graphql';
import { nodesOf } from '../../lib/connection';

export type StatRange = 30 | 90;

export const STAT_RANGES: StatRange[] = [30, 90];

export function useContentStats() {
  const query = useContentStatsQuery();

  return {
    stats: query.data?.contentStats,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useStatsSnapshots(range: StatRange) {
  const query = useStatsSnapshotsQuery({ last: range });

  return {
    snapshots: query.data && nodesOf(query.data.statsSnapshots),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
