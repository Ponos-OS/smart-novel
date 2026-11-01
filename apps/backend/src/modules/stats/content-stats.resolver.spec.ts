import { ContentStatsResolver } from './content-stats.resolver';
import { ContentStatsService } from './content-stats.service';

describe(ContentStatsResolver.name, () => {
  let uut: ContentStatsResolver;
  let service: Record<
    'findLiveTotals' | 'findHistoryConnection',
    ReturnType<typeof vi.fn>
  >;

  beforeEach(() => {
    service = {
      findLiveTotals: vi.fn(),
      findHistoryConnection: vi.fn(),
    };
    uut = new ContentStatsResolver(
      service as unknown as ContentStatsService,
    );
  });

  it('should return the live totals', async () => {
    const totals = {
      estimatedNovelCount: 1204,
      estimatedChapterCount: 14231,
    };
    service.findLiveTotals.mockResolvedValue(totals);

    const result = await uut.contentStats();

    expect(result).toBe(totals);
  });

  it('should hand the pagination and the filters to the service', async () => {
    const filters = { from: new Date('2026-10-01T00:00:00.000Z') };

    await uut.statsSnapshotsConnection(
      undefined,
      30,
      undefined,
      'abc.def',
      filters,
    );

    expect(service.findHistoryConnection).toHaveBeenCalledWith(
      {
        first: undefined,
        last: 30,
        after: undefined,
        before: 'abc.def',
      },
      filters,
    );
  });
});
