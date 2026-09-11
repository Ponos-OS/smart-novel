import { RedisService } from '../../redis';
import { RedisJobToChapterMap } from './redis-job-to-chapter-map.provider';

describe(RedisJobToChapterMap.name, () => {
  let uut: RedisJobToChapterMap;
  let redisService: RedisService;
  const mockJobId = '2bce49d6-6592-4ed3-b421-f913b9ecc3bd';
  const mockChapterId = '4dd92f16-4743-47b9-960c-6529678e9bc5';

  beforeEach(() => {
    redisService = {
      get: vi.fn(),
      set: vi.fn(),
    } as any;

    uut = new RedisJobToChapterMap(redisService);
  });

  describe('set', () => {
    it('should store the chapter id under a namespaced key with a TTL', async () => {
      // Act
      await uut.set(mockJobId, mockChapterId);

      // Assert
      expect(redisService.set).toHaveBeenCalledWith(
        `tts_job_chapter:${mockJobId}`,
        mockChapterId,
        { ttlSeconds: 60 * 60 },
      );
    });
  });

  describe('get', () => {
    it('should return the chapter id for a jobId that was set', async () => {
      // Arrange
      vi.mocked(redisService.get).mockResolvedValue(mockChapterId);

      // Act
      const result = await uut.get(mockJobId);

      // Assert
      expect(redisService.get).toHaveBeenCalledWith(
        `tts_job_chapter:${mockJobId}`,
      );
      expect(result).toBe(mockChapterId);
    });

    it('should return undefined for an unknown or expired jobId', async () => {
      // Arrange
      vi.mocked(redisService.get).mockResolvedValue(null);

      // Act
      const result = await uut.get('unknown-job-id');

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
