import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NarrationStatus } from '@prisma/client';
import { PubSubEngine } from 'graphql-subscriptions';
import { CustomLoggerService } from 'nestjs-backend-common';

import { appConfigs } from '../../../app';
import { LlmClient } from '../../llm';
import { RedisService } from '../../redis';
import {
  IChapterContentRepository,
  IChapterRepository,
} from '../interfaces';
import { chapterNarrationUpdateSubscriptionKey } from '../utils';
import { ChapterNarrationService } from './chapter-narration.service';
import { NarrationLockService } from './narration-lock.service';

describe(ChapterNarrationService.name, () => {
  let uut: ChapterNarrationService;
  let logger: CustomLoggerService;
  let narrationLockService: NarrationLockService;
  let pubSub: PubSubEngine;
  let chapterRepository: IChapterRepository;
  let chapterContentRepository: IChapterContentRepository;
  let appConfig: ConfigType<typeof appConfigs>;
  let llmClient: LlmClient;
  let redisService: RedisService;
  const mockChapterId = 'e8cec22d-a2c2-4f68-ac1c-6a3cdbbfef33';
  const mockJobId = '2bce49d6-6592-4ed3-b421-f913b9ecc3bd';
  const mockLockKey = `chapter_tts:${mockChapterId}`;
  const mockLockToken = 'lock-token-abc';
  const mockAuthorization = 'Bearer some-jwt';

  beforeEach(() => {
    vi.clearAllMocks();
    logger = {
      debug: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;
    narrationLockService = {
      tryAcquire: vi.fn().mockResolvedValue(mockLockToken),
      release: vi.fn(),
      getLockKey: vi.fn().mockReturnValue(mockLockKey),
      exists: vi.fn(),
    } as any;
    pubSub = {
      publish: vi.fn(),
      asyncIterableIterator: vi.fn(),
    } as any;
    chapterRepository = {
      findById: vi.fn(),
      updateChapterNarrationUrl: vi.fn(),
    } as any;
    chapterContentRepository = {
      findByChapterId: vi.fn(),
    } as any;
    appConfig = {
      BACKEND_INTERNAL_URL: 'http://backend:3000',
      BEATRICE_DEFAULT_VOICE: 'default',
      OBJECT_STORAGE_PUBLIC_URL: 'http://localhost:9000',
      OBJECT_STORAGE_BUCKET: 'smart-novel',
    } as any;
    llmClient = {
      generateAudio: vi.fn(),
    } as any;
    redisService = {
      subscribe: vi.fn(),
    } as any;

    uut = new ChapterNarrationService(
      logger,
      narrationLockService,
      pubSub,
      chapterRepository,
      chapterContentRepository,
      appConfig,
      llmClient,
      redisService,
    );
  });

  describe('generateChapterAudio', () => {
    it('should throw BadRequestException if chapter not found', async () => {
      // Arrange
      vi.mocked(chapterRepository.findById).mockResolvedValue(null);

      // Act
      const res = uut.generateChapterAudio(
        mockChapterId,
        mockAuthorization,
      );

      // Assert
      await expect(res).rejects.toThrow(
        new BadRequestException('Chapter not found'),
      );
    });

    it('should throw BadRequestException if the chapter has no content', async () => {
      // Arrange
      vi.mocked(chapterRepository.findById).mockResolvedValue({
        id: mockChapterId,
      } as any);
      vi.mocked(
        chapterContentRepository.findByChapterId,
      ).mockResolvedValue({
        id: '69f8cc7c-0974-433b-9bfc-135b39164246',
        content: '',
        contentHash:
          '089a4bfbf15cd6a3ca36f8a37daa23befa2468190f7aa7e8867a199eaa38060b',
      });

      // Act
      const res = uut.generateChapterAudio(
        mockChapterId,
        mockAuthorization,
      );

      // Assert
      await expect(res).rejects.toThrow(
        new BadRequestException('Chapter has no content to narrate'),
      );
    });

    it('should throw ConflictException when a generation is already in flight for the chapter', async () => {
      // Arrange
      vi.mocked(chapterRepository.findById).mockResolvedValue({
        id: mockChapterId,
      } as any);
      vi.mocked(
        chapterContentRepository.findByChapterId,
      ).mockResolvedValue({
        id: '69f8cc7c-0974-433b-9bfc-135b39164246',
        content: '# Chapter Title\n\nChapter content',
        contentHash: 'hash',
      });
      vi.mocked(narrationLockService.tryAcquire).mockResolvedValue(
        null,
      );

      // Act
      const res = uut.generateChapterAudio(
        mockChapterId,
        mockAuthorization,
      );

      // Assert
      await expect(res).rejects.toThrow(
        new ConflictException(
          'Narration generation is already in progress for this chapter',
        ),
      );
      expect(llmClient.generateAudio).not.toHaveBeenCalled();
    });

    it('should queue a Beatrice job passing the chapterId as clientContextId, and return PROCESSING', async () => {
      // Arrange
      const content = '# Chapter Title\n\nChapter content';
      vi.mocked(chapterRepository.findById).mockResolvedValue({
        id: mockChapterId,
      } as any);
      vi.mocked(
        chapterContentRepository.findByChapterId,
      ).mockResolvedValue({
        id: '69f8cc7c-0974-433b-9bfc-135b39164246',
        content,
        contentHash: 'hash',
      });
      vi.mocked(llmClient.generateAudio).mockResolvedValue({
        generateAudio: { jobId: mockJobId },
      });

      // Act
      const result = await uut.generateChapterAudio(
        mockChapterId,
        mockAuthorization,
      );

      // Assert
      expect(result).toEqual({ status: NarrationStatus.PROCESSING });
      expect(llmClient.generateAudio).toHaveBeenCalledWith(
        content,
        'default',
        'http://backend:3000/beatrice-callbacks/gen-upload-url',
        'http://backend:3000/beatrice-callbacks/status',
        mockChapterId,
        mockAuthorization,
      );
      expect(narrationLockService.release).not.toHaveBeenCalled();
    });

    it('should release the lock and resolve without throwing when Beatrice generateAudio fails', async () => {
      // Arrange
      vi.mocked(chapterRepository.findById).mockResolvedValue({
        id: mockChapterId,
      } as any);
      vi.mocked(
        chapterContentRepository.findByChapterId,
      ).mockResolvedValue({
        id: '69f8cc7c-0974-433b-9bfc-135b39164246',
        content: '# Chapter Title\n\nChapter content',
        contentHash: 'hash',
      });
      vi.mocked(llmClient.generateAudio).mockRejectedValue(
        new Error('Beatrice unreachable'),
      );

      // Act
      const result = await uut.generateChapterAudio(
        mockChapterId,
        mockAuthorization,
      );

      // Assert
      expect(result).toEqual({ status: NarrationStatus.PROCESSING });
      expect(narrationLockService.release).toHaveBeenCalledWith(
        mockLockKey,
        mockLockToken,
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Beatrice unreachable'),
        expect.any(Object),
      );
    });
  });

  describe('subscribeToChapterNarration', () => {
    it('should return async iterator for chapter narration updates', () => {
      // Act
      const result = uut.subscribeToChapterNarration(mockChapterId);

      // Assert
      expect(pubSub.asyncIterableIterator).toHaveBeenCalledWith(
        chapterNarrationUpdateSubscriptionKey(mockChapterId),
      );
    });
  });

  describe('regenerateAudio', () => {
    it('should call Beatrice generateAudio with the expected callback URLs, voice, and clientContextId', async () => {
      // Arrange
      const content = '# Chapter 1\n\nSome content';
      vi.mocked(llmClient.generateAudio).mockResolvedValue({
        generateAudio: { jobId: mockJobId },
      });

      // Act
      await uut.regenerateAudio(
        mockChapterId,
        content,
        mockAuthorization,
      );

      // Assert
      expect(llmClient.generateAudio).toHaveBeenCalledWith(
        content,
        'default',
        'http://backend:3000/beatrice-callbacks/gen-upload-url',
        'http://backend:3000/beatrice-callbacks/status',
        mockChapterId,
        mockAuthorization,
      );
    });

    it('should log and resolve (not throw) when Beatrice generateAudio fails', async () => {
      // Arrange
      const content = '# Chapter 1\n\nSome content';
      vi.mocked(llmClient.generateAudio).mockRejectedValue(
        new Error('Beatrice unreachable'),
      );

      // Act
      const result = uut.regenerateAudio(
        mockChapterId,
        content,
        mockAuthorization,
      );

      // Assert
      await expect(result).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Beatrice unreachable'),
        expect.any(Object),
      );
    });

    it('should skip silently (not throw) when a generation is already in flight for the chapter', async () => {
      // Arrange
      const content = '# Chapter 1\n\nSome content';
      vi.mocked(narrationLockService.tryAcquire).mockResolvedValue(
        null,
      );

      // Act
      const result = uut.regenerateAudio(
        mockChapterId,
        content,
        mockAuthorization,
      );

      // Assert
      await expect(result).resolves.toBeUndefined();
      expect(llmClient.generateAudio).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(mockChapterId),
        expect.any(Object),
      );
    });
  });

  describe('onModuleInit', () => {
    it('should subscribe to the TTS status channel', async () => {
      // Act
      await uut.onModuleInit();

      // Assert
      expect(redisService.subscribe).toHaveBeenCalledWith(
        'tts-audio:status',
        expect.any(Function),
      );
    });
  });

  describe('handleStatusUpdate (private, via onModuleInit subscription)', () => {
    it('should persist the audio URL and publish a READY event for a completed callback carrying clientContextId', async () => {
      // Arrange
      const message = JSON.stringify({
        jobId: mockJobId,
        status: 'completed',
        fileSizeBytes: 4,
        attempt: 1,
        clientContextId: mockChapterId,
      });

      // Act
      await (uut as any).handleStatusUpdate(message);

      // Assert
      expect(
        chapterRepository.updateChapterNarrationUrl,
      ).toHaveBeenCalledWith(
        mockChapterId,
        `http://localhost:9000/smart-novel/narrations/${mockJobId}.mp3`,
      );
      expect(pubSub.publish).toHaveBeenCalledWith(
        chapterNarrationUpdateSubscriptionKey(mockChapterId),
        {
          chapterNarrationUpdated: {
            chapterId: mockChapterId,
            status: NarrationStatus.READY,
            narrationUrl: `http://localhost:9000/smart-novel/narrations/${mockJobId}.mp3`,
            stage: undefined,
            error: undefined,
          },
        },
      );
    });

    it.each([
      'queued',
      'generating',
      'uploading',
      'completed',
      'failed',
    ])(
      'should log and drop a "%s" callback with no clientContextId, without publishing',
      async (status) => {
        // Arrange
        const message = JSON.stringify({ jobId: mockJobId, status });

        // Act
        await (uut as any).handleStatusUpdate(message);

        // Assert
        expect(
          chapterRepository.updateChapterNarrationUrl,
        ).not.toHaveBeenCalled();
        expect(pubSub.publish).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(mockJobId),
          expect.any(Object),
        );
      },
    );

    it.each(['queued', 'generating', 'uploading'])(
      'should publish a PROCESSING event carrying the raw stage for a "%s" callback, without persisting a narration URL',
      async (status) => {
        // Arrange
        const message = JSON.stringify({
          jobId: mockJobId,
          status,
          clientContextId: mockChapterId,
        });

        // Act
        await (uut as any).handleStatusUpdate(message);

        // Assert
        expect(
          chapterRepository.updateChapterNarrationUrl,
        ).not.toHaveBeenCalled();
        expect(pubSub.publish).toHaveBeenCalledWith(
          chapterNarrationUpdateSubscriptionKey(mockChapterId),
          {
            chapterNarrationUpdated: {
              chapterId: mockChapterId,
              status: NarrationStatus.PROCESSING,
              narrationUrl: undefined,
              stage: status,
              error: undefined,
            },
          },
        );
      },
    );

    it('should publish a FAILED event with the error flattened to a string, without persisting a narration URL', async () => {
      // Arrange
      const message = JSON.stringify({
        jobId: mockJobId,
        status: 'failed',
        failedAt: '2026-09-10T00:00:00.000Z',
        clientContextId: mockChapterId,
        error: {
          code: 'TTS_PROVIDER_ERROR',
          message: 'qwen-tts timed out',
        },
      });

      // Act
      await (uut as any).handleStatusUpdate(message);

      // Assert
      expect(
        chapterRepository.updateChapterNarrationUrl,
      ).not.toHaveBeenCalled();
      expect(pubSub.publish).toHaveBeenCalledWith(
        chapterNarrationUpdateSubscriptionKey(mockChapterId),
        {
          chapterNarrationUpdated: {
            chapterId: mockChapterId,
            status: NarrationStatus.FAILED,
            narrationUrl: undefined,
            stage: undefined,
            error: 'TTS_PROVIDER_ERROR: qwen-tts timed out',
          },
        },
      );
    });

    it('should log an error for a "failed" callback carrying clientContextId', async () => {
      // Arrange
      const message = JSON.stringify({
        jobId: mockJobId,
        status: 'failed',
        failedAt: '2026-09-10T00:00:00.000Z',
        clientContextId: mockChapterId,
        error: {
          code: 'TTS_PROVIDER_ERROR',
          message: 'qwen-tts timed out',
        },
      });

      // Act
      await (uut as any).handleStatusUpdate(message);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `job ${mockJobId} for chapter ${mockChapterId} as failed: TTS_PROVIDER_ERROR: qwen-tts timed out`,
        ),
        expect.any(Object),
      );
    });

    it.each(['completed', 'failed'])(
      'should release the narration lock held for the job on a "%s" callback',
      async (status) => {
        // Arrange
        (uut as any).jobLockTokens.set(mockJobId, {
          lockKey: mockLockKey,
          token: mockLockToken,
        });
        const message = JSON.stringify({
          jobId: mockJobId,
          status,
          fileSizeBytes: 4,
          attempt: 1,
          failedAt: '2026-09-10T00:00:00.000Z',
          clientContextId: mockChapterId,
          error: { code: 'TTS_PROVIDER_ERROR', message: 'oops' },
        });

        // Act
        await (uut as any).handleStatusUpdate(message);

        // Assert
        expect(narrationLockService.release).toHaveBeenCalledWith(
          mockLockKey,
          mockLockToken,
        );
        expect((uut as any).jobLockTokens.has(mockJobId)).toBeFalse();
      },
    );

    it.each(['queued', 'generating', 'uploading'])(
      'should NOT release the narration lock on a "%s" (non-terminal) callback',
      async (status) => {
        // Arrange
        (uut as any).jobLockTokens.set(mockJobId, {
          lockKey: mockLockKey,
          token: mockLockToken,
        });
        const message = JSON.stringify({
          jobId: mockJobId,
          status,
          clientContextId: mockChapterId,
        });

        // Act
        await (uut as any).handleStatusUpdate(message);

        // Assert
        expect(narrationLockService.release).not.toHaveBeenCalled();
      },
    );

    it('should not attempt to release a lock for a job this replica never queued', async () => {
      // Arrange
      const message = JSON.stringify({
        jobId: mockJobId,
        status: 'completed',
        fileSizeBytes: 4,
        attempt: 1,
        clientContextId: mockChapterId,
      });

      // Act
      await (uut as any).handleStatusUpdate(message);

      // Assert
      expect(narrationLockService.release).not.toHaveBeenCalled();
    });

    it('should drop a stale "queued" (progress 1) callback arriving after "generating" (progress 2), never publishing it', async () => {
      // Arrange
      const generating = JSON.stringify({
        jobId: mockJobId,
        status: 'generating',
        progress: 2,
        clientContextId: mockChapterId,
      });
      const staleQueued = JSON.stringify({
        jobId: mockJobId,
        status: 'queued',
        progress: 1,
        clientContextId: mockChapterId,
      });

      // Act
      await (uut as any).handleStatusUpdate(generating);
      vi.mocked(pubSub.publish).mockClear();
      await (uut as any).handleStatusUpdate(staleQueued);

      // Assert
      expect(pubSub.publish).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(mockJobId),
        expect.any(Object),
      );
    });

    it('should drop a duplicate callback reporting the same progress as already seen', async () => {
      // Arrange
      const generating = JSON.stringify({
        jobId: mockJobId,
        status: 'generating',
        progress: 2,
        clientContextId: mockChapterId,
      });

      // Act
      await (uut as any).handleStatusUpdate(generating);
      vi.mocked(pubSub.publish).mockClear();
      await (uut as any).handleStatusUpdate(generating);

      // Assert
      expect(pubSub.publish).not.toHaveBeenCalled();
    });

    it('should apply the normal in-order sequence unaffected: queued, generating, uploading, then completed', async () => {
      // Arrange
      const stages = [
        { status: 'queued', progress: 1 },
        { status: 'generating', progress: 2 },
        { status: 'uploading', progress: 3 },
      ];

      // Act
      for (const stage of stages) {
        await (uut as any).handleStatusUpdate(
          JSON.stringify({
            jobId: mockJobId,
            ...stage,
            clientContextId: mockChapterId,
          }),
        );
      }
      await (uut as any).handleStatusUpdate(
        JSON.stringify({
          jobId: mockJobId,
          status: 'completed',
          fileSizeBytes: 4,
          attempt: 1,
          clientContextId: mockChapterId,
        }),
      );

      // Assert
      expect(pubSub.publish).toHaveBeenCalledTimes(4);
      expect(
        chapterRepository.updateChapterNarrationUrl,
      ).toHaveBeenCalledTimes(1);
    });

    it.each(['completed', 'failed'])(
      'should drop any callback arriving after a "%s" terminal status for the same job, never publishing it',
      async (terminalStatus) => {
        // Arrange
        const terminal = JSON.stringify({
          jobId: mockJobId,
          status: terminalStatus,
          fileSizeBytes: 4,
          failedAt: '2026-09-12T00:00:00.000Z',
          clientContextId: mockChapterId,
        });
        const lateCallback = JSON.stringify({
          jobId: mockJobId,
          status: 'generating',
          progress: 2,
          clientContextId: mockChapterId,
        });

        // Act
        await (uut as any).handleStatusUpdate(terminal);
        vi.mocked(pubSub.publish).mockClear();
        await (uut as any).handleStatusUpdate(lateCallback);

        // Assert
        expect(pubSub.publish).not.toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(mockJobId),
          expect.any(Object),
        );
      },
    );

    it.each(['completed', 'failed'])(
      'should keep the job marked terminal in jobProgressState after a "%s" callback, unlike jobLockTokens which is deleted',
      async (terminalStatus) => {
        // Arrange
        const message = JSON.stringify({
          jobId: mockJobId,
          status: terminalStatus,
          fileSizeBytes: 4,
          failedAt: '2026-09-12T00:00:00.000Z',
          clientContextId: mockChapterId,
        });

        // Act
        await (uut as any).handleStatusUpdate(message);

        // Assert
        expect((uut as any).jobProgressState.get(mockJobId)).toEqual({
          lastSeen: 0,
          terminal: true,
        });
      },
    );
  });
});
