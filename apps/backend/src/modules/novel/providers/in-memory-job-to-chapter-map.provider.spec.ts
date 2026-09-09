import { InMemoryJobToChapterMap } from './in-memory-job-to-chapter-map.provider';

describe(InMemoryJobToChapterMap.name, () => {
  let uut: InMemoryJobToChapterMap;

  beforeEach(() => {
    uut = new InMemoryJobToChapterMap();
  });

  it('should return the chapter id for a jobId that was set', () => {
    uut.set(
      '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
      '4dd92f16-4743-47b9-960c-6529678e9bc5',
    );

    const result = uut.get('2bce49d6-6592-4ed3-b421-f913b9ecc3bd');

    expect(result).toBe('4dd92f16-4743-47b9-960c-6529678e9bc5');
  });

  it('should return undefined for an unknown jobId', () => {
    const result = uut.get('unknown-job-id');

    expect(result).toBeUndefined();
  });
});
