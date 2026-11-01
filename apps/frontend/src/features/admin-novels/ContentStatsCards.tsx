import { ContentStatCard } from './ContentStatCard';
import { useContentStats } from './use-content-stats';

export function ContentStatsCards() {
  const { stats, isError } = useContentStats();

  return (
    <div className="mb-6 grid gap-4 md:grid-cols-2">
      <ContentStatCard
        noun="novels"
        field="novelCount"
        estimate={stats?.estimatedNovelCount}
        estimateFailed={isError}
      />
      <ContentStatCard
        noun="chapters"
        field="chapterCount"
        estimate={stats?.estimatedChapterCount}
        estimateFailed={isError}
      />
    </div>
  );
}
