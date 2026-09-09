import { S3Client } from '@aws-sdk/client-s3';
import { BadRequestException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NarrationStatus } from '@prisma/client';
import { PubSubEngine } from 'graphql-subscriptions';
import { CustomLoggerService } from 'nestjs-backend-common';

import { appConfigs } from '../../../app';
import { BackgroundRunnerService } from '../../background-runner';
import { LlmClient } from '../../llm';
import { PrismaService } from '../../prisma';
import { RedisService } from '../../redis';
import { IChapterRepository, IJobToChapterMap } from '../interfaces';
import { chapterNarrationUpdateSubscriptionKey } from '../utils';
import { ChapterNarrationService } from './chapter-narration.service';
import { NarrationLockService } from './narration-lock.service';

vi.mock('axios');
vi.mock('../../object-storage', async () => {
  const actual = await vi.importActual('../../object-storage');

  return {
    ...actual,
    UploaderService: vi.fn().mockImplementation(() => ({
      upload: vi.fn(),
      abortUpload: vi.fn(),
    })),
    createChecksum: vi.fn().mockReturnValue({
      update: vi.fn(),
      digestBase64: vi.fn().mockReturnValue('mock-checksum'),
    }),
  };
});

describe(ChapterNarrationService.name, () => {
  let uut: ChapterNarrationService;
  let s3Client: S3Client;
  let logger: CustomLoggerService;
  let narrationLockService: NarrationLockService;
  let prisma: PrismaService;
  let backgroundRunner: BackgroundRunnerService;
  let pubSub: PubSubEngine;
  let chapterRepository: IChapterRepository;
  let appConfig: ConfigType<typeof appConfigs>;
  let llmClient: LlmClient;
  let jobToChapterMap: IJobToChapterMap;
  let redisService: RedisService;
  const mockChapterId = 'e8cec22d-a2c2-4f68-ac1c-6a3cdbbfef33';
  const mockNarrationUrl =
    'http://localhost:9000/smart-novel/narrations/chapter-e8cec22d-a2c2-4f68-ac1c-6a3cdbbfef33.mp3';

  beforeEach(() => {
    vi.clearAllMocks();
    s3Client = {} as any;
    logger = {
      debug: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;
    narrationLockService = {
      tryAcquire: vi.fn(),
      release: vi.fn(),
      getLockKey: vi.fn().mockReturnValue(''),
      exists: vi.fn(),
    } as any;
    prisma = {
      $transaction: vi.fn(),
      chapter: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    } as any;
    backgroundRunner = {
      run: vi.fn((fn: () => Promise<void>) => {
        void fn();
      }),
    } as any;
    pubSub = {
      publish: vi.fn(),
      asyncIterableIterator: vi.fn(),
    } as any;
    chapterRepository = {
      updateChapterNarrationComplete: vi.fn(),
      updateNarrationStatus: vi.fn(),
      updateChapterNarrationUrl: vi.fn(),
    } as any;
    appConfig = {
      TTS_ENDPOINT: 'http://tts-service/api/tts',
      BACKEND_INTERNAL_URL: 'http://backend:3000',
      BEATRICE_DEFAULT_VOICE: 'default',
      OBJECT_STORAGE_PUBLIC_URL: 'http://localhost:9000',
      OBJECT_STORAGE_BUCKET: 'smart-novel',
    } as any;
    llmClient = {
      generateAudio: vi.fn(),
    } as any;
    jobToChapterMap = {
      set: vi.fn(),
      get: vi.fn(),
    } as any;
    redisService = {
      subscribe: vi.fn(),
    } as any;

    uut = new ChapterNarrationService(
      s3Client,
      logger,
      narrationLockService,
      prisma,
      backgroundRunner,
      pubSub,
      chapterRepository,
      appConfig,
      llmClient,
      jobToChapterMap,
      redisService,
    );
  });

  describe('startGeneration', () => {
    it('should return READY status if narration already exists', async () => {
      // Arrange
      vi.mocked(prisma.$transaction).mockImplementation(
        async (callback: any) => {
          return callback({
            chapter: {
              findUnique: vi.fn().mockResolvedValue({
                id: mockChapterId,
                content: {
                  id: '69f8cc7c-0974-433b-9bfc-135b39164246',
                  content: 'Chapter content',
                  contentHash:
                    'bbb5c978731fabeea7f228aa482143f59734a1419c728e1a30ab3a53e96199e0',
                },
                narrationUrl: mockNarrationUrl,
                narrationStatus: 'READY',
              }),
            },
          });
        },
      );

      // Act
      const result = await uut.startGeneration(mockChapterId);

      // Assert
      expect(result).toEqual({
        status: NarrationStatus.READY,
        narrationUrl: mockNarrationUrl,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Narration already exists'),
        expect.any(Object),
      );
      expect(narrationLockService.tryAcquire).not.toHaveBeenCalled();
    });

    it('should force its way to start generating a new narration if forceRegenerate is true', async () => {
      // Arrange
      vi.mocked(prisma.$transaction).mockImplementation(
        async (callback: any) => {
          return callback({
            chapter: {
              findUnique: vi.fn().mockResolvedValue({
                id: mockChapterId,
                content: {
                  id: '69f8cc7c-0974-433b-9bfc-135b39164246',
                  content: 'Chapter content',
                  contentHash:
                    'bbb5c978731fabeea7f228aa482143f59734a1419c728e1a30ab3a53e96199e0',
                },
                narrationUrl: mockNarrationUrl,
                narrationStatus: 'READY',
              }),
              update: vi.fn().mockResolvedValue({
                id: mockChapterId,
                content: {
                  id: '69f8cc7c-0974-433b-9bfc-135b39164246',
                  content: 'Chapter content',
                  contentHash:
                    'bbb5c978731fabeea7f228aa482143f59734a1419c728e1a30ab3a53e96199e0',
                },
                narrationUrl: null,
                narrationStatus: 'PENDING',
              }),
            },
          });
        },
      );
      vi.mocked(narrationLockService.tryAcquire).mockResolvedValue(
        '',
      );

      // Act
      const result = await uut.startGeneration(mockChapterId, true);

      // Assert
      expect(result).toEqual({ status: NarrationStatus.PROCESSING });
      expect(narrationLockService.tryAcquire).toHaveBeenCalled();
    });

    it('should cancel in-flight TTS and regenerate when forceRegenerate=true', async () => {
      // Arrange
      vi.mocked(prisma.$transaction).mockImplementation(
        async (callback: any) => {
          return callback({
            chapter: {
              findUnique: vi.fn().mockResolvedValue({
                id: mockChapterId,
                content: {
                  id: '69f8cc7c-0974-433b-9bfc-135b39164246',
                  content: 'Chapter content',
                  contentHash:
                    'bbb5c978731fabeea7f228aa482143f59734a1419c728e1a30ab3a53e96199e0',
                },
                narrationUrl: mockNarrationUrl,
                narrationStatus: 'READY',
              }),
              update: vi.fn().mockResolvedValue({
                id: mockChapterId,
                content: {
                  id: '69f8cc7c-0974-433b-9bfc-135b39164246',
                  content: 'Chapter content',
                  contentHash:
                    'bbb5c978731fabeea7f228aa482143f59734a1419c728e1a30ab3a53e96199e0',
                },
                narrationUrl: null,
                narrationStatus: 'PROCESSING',
              }),
            },
          });
        },
      );
      vi.mocked(narrationLockService.tryAcquire).mockResolvedValue(
        'new-token',
      );

      // Simulate an in-flight controller
      const mockController = new AbortController();
      const abortSpy = vi.spyOn(mockController, 'abort');
      (uut as any).inFlightTtsRequests.set(
        mockChapterId,
        mockController,
      );

      // Act
      const result = await uut.startGeneration(mockChapterId, true);

      // Assert
      expect(result).toEqual({ status: NarrationStatus.PROCESSING });
      expect(abortSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Force-regenerate'),
        }),
      );
      expect(narrationLockService.tryAcquire).toHaveBeenCalledWith(
        expect.any(String),
        3600000,
        true,
      );
    });

    it('should throw BadRequestException if chapter not found', async () => {
      // Arrange
      vi.mocked(prisma.$transaction).mockImplementation(
        async (callback: any) => {
          return callback({
            chapter: {
              findUnique: vi.fn().mockResolvedValue(null),
            },
          });
        },
      );

      // Act
      const res = uut.startGeneration(mockChapterId);

      // Assert
      await expect(res).rejects.toThrow(
        new BadRequestException('Chapter not found'),
      );
    });

    it("should return PROCESSING status if lock can NOT be acquired (we're already processing it)", async () => {
      // Arrange
      vi.mocked(prisma.$transaction).mockImplementation(
        async (callback: any) => {
          return callback({
            chapter: {
              findUnique: vi.fn().mockResolvedValue({
                id: mockChapterId,
                content: {
                  id: '69f8cc7c-0974-433b-9bfc-135b39164246',
                  content: 'Chapter content',
                  contentHash:
                    'bbb5c978731fabeea7f228aa482143f59734a1419c728e1a30ab3a53e96199e0',
                },
                narrationUrl: null,
                narrationStatus: 'PENDING',
              }),
            },
          });
        },
      );
      vi.mocked(narrationLockService.tryAcquire).mockResolvedValue(
        null,
      );

      // Act
      const result = await uut.startGeneration(mockChapterId);

      // Assert
      expect(result).toEqual({
        status: NarrationStatus.PROCESSING,
      });
      expect(narrationLockService.getLockKey).toHaveBeenCalledWith(
        mockChapterId,
      );
      expect(narrationLockService.tryAcquire).toHaveBeenCalledWith(
        expect.any(String),
        3600000, // 1 hour in ms
        false,
      );
    });

    it('should return READY if narration was created after lock acquisition (race condition)', async () => {
      // Arrange
      const initialChapter = {
        id: mockChapterId,
        content: {
          id: '69f8cc7c-0974-433b-9bfc-135b39164246',
          content: 'Chapter content',
          contentHash: 'hash',
        },
        narrationUrl: null,
        narrationStatus: 'PENDING',
      };
      const recheckChapter = {
        ...initialChapter,
        narrationUrl: mockNarrationUrl,
        narrationStatus: 'READY',
      };
      let callCount = 0;
      vi.mocked(prisma.$transaction).mockImplementation(
        async (callback: any) => {
          return callback({
            chapter: {
              findUnique: vi.fn().mockImplementation(() => {
                callCount++;
                return callCount === 1
                  ? initialChapter
                  : recheckChapter;
              }),
            },
          });
        },
      );
      vi.mocked(narrationLockService.tryAcquire).mockResolvedValue(
        '',
      );

      // Act
      const result = await uut.startGeneration(mockChapterId);

      // Assert
      expect(result).toEqual({
        status: NarrationStatus.READY,
        narrationUrl: mockNarrationUrl,
      });
      expect(narrationLockService.release).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
      );
    });

    it('should return PROCESSING if chapter is already being processed after lock acquisition', async () => {
      // Arrange
      const initialChapter = {
        id: mockChapterId,
        content: {
          id: '69f8cc7c-0974-433b-9bfc-135b39164246',
          content: 'Chapter content',
          contentHash:
            'bbb5c978731fabeea7f228aa482143f59734a1419c728e1a30ab3a53e96199e0',
        },
        narrationUrl: null,
        narrationStatus: 'PENDING',
      };
      const recheckChapter = {
        ...initialChapter,
        narrationStatus: 'PROCESSING',
      };
      let callCount = 0;
      vi.mocked(prisma.$transaction).mockImplementation(
        async (callback: any) => {
          return callback({
            chapter: {
              findUnique: vi.fn().mockImplementation(() => {
                callCount++;
                return callCount === 1
                  ? initialChapter
                  : recheckChapter;
              }),
            },
          });
        },
      );
      vi.mocked(narrationLockService.tryAcquire).mockResolvedValue(
        '',
      );

      // Act
      const result = await uut.startGeneration(mockChapterId);

      // Assert
      expect(result).toEqual({
        status: NarrationStatus.PROCESSING,
      });
      expect(narrationLockService.release).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
      );
    });

    it('should throw BadRequestException if the chapter has no content', async () => {
      // Arrange
      vi.mocked(prisma.$transaction).mockImplementation(
        async (callback: any) => {
          return callback({
            chapter: {
              findUnique: vi.fn().mockResolvedValue({
                id: mockChapterId,
                content: {
                  id: '69f8cc7c-0974-433b-9bfc-135b39164246',
                  content: '',
                  contentHash:
                    '089a4bfbf15cd6a3ca36f8a37daa23befa2468190f7aa7e8867a199eaa38060b',
                },
                narrationUrl: null,
                narrationStatus: 'PENDING',
              }),
            },
          });
        },
      );
      vi.mocked(narrationLockService.tryAcquire).mockResolvedValue(
        '',
      );

      // Act
      const res = uut.startGeneration(mockChapterId);

      // Assert
      await expect(res).rejects.toThrow(
        new BadRequestException('Chapter has no content to narrate'),
      );
    });

    it('should start background processing and return PROCESSING status', async () => {
      // Arrange
      const chapter = {
        id: mockChapterId,
        content: {
          id: '69f8cc7c-0974-433b-9bfc-135b39164246',
          content: '# Chapter Title\n\nChapter content',
          contentHash:
            '089a4bfbf15cd6a3ca36f8a37daa23befa2468190f7aa7e8867a199eaa38060b',
        },
        narrationUrl: null,
        narrationStatus: 'PENDING',
      };
      const updatedChapter = {
        ...chapter,
        narrationStatus: 'PROCESSING',
      };
      vi.mocked(prisma.$transaction).mockImplementation(
        async (callback: any) => {
          return callback({
            chapter: {
              findUnique: vi.fn().mockResolvedValue(chapter),
              update: vi.fn().mockResolvedValue(updatedChapter),
            },
          });
        },
      );
      vi.mocked(narrationLockService.tryAcquire).mockResolvedValue(
        '',
      );

      // Act
      const result = await uut.startGeneration(mockChapterId);

      // Assert
      expect(result).toEqual({
        status: NarrationStatus.PROCESSING,
      });
      expect(pubSub.publish).toHaveBeenCalledWith(
        chapterNarrationUpdateSubscriptionKey(mockChapterId),
        {
          chapterNarrationUpdated: {
            chapterId: mockChapterId,
            status: NarrationStatus.PROCESSING,
          },
        },
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
    it('should call Beatrice generateAudio with the expected callback URLs and voice, then record the jobId in the map', async () => {
      // Arrange
      const content = '# Chapter 1\n\nSome content';
      vi.mocked(llmClient.generateAudio).mockResolvedValue({
        generateAudio: {
          jobId: '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
        },
      });

      // Act
      await uut.regenerateAudio(mockChapterId, content);

      // Assert
      expect(llmClient.generateAudio).toHaveBeenCalledWith(
        content,
        'default',
        'http://backend:3000/beatrice-callbacks/gen-upload-url',
        'http://backend:3000/beatrice-callbacks/status',
      );
      expect(jobToChapterMap.set).toHaveBeenCalledWith(
        '2bce49d6-6592-4ed3-b421-f913b9ecc3bd',
        mockChapterId,
      );
    });

    it('should log and resolve (not throw) when Beatrice generateAudio fails, and not touch the map', async () => {
      // Arrange
      const content = '# Chapter 1\n\nSome content';
      vi.mocked(llmClient.generateAudio).mockRejectedValue(
        new Error('Beatrice unreachable'),
      );

      // Act
      const result = uut.regenerateAudio(mockChapterId, content);

      // Assert
      await expect(result).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Beatrice unreachable'),
        expect.any(Object),
      );
      expect(jobToChapterMap.set).not.toHaveBeenCalled();
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
    const mockJobId = '2bce49d6-6592-4ed3-b421-f913b9ecc3bd';

    it('should persist the audio URL for a completed callback whose job is mapped to a chapter', async () => {
      // Arrange
      vi.mocked(jobToChapterMap.get).mockReturnValue(mockChapterId);
      const message = JSON.stringify({
        jobId: mockJobId,
        status: 'completed',
        fileSizeBytes: 4,
        attempt: 1,
      });

      // Act
      await (uut as any).handleStatusUpdate(message);

      // Assert
      expect(jobToChapterMap.get).toHaveBeenCalledWith(mockJobId);
      expect(
        chapterRepository.updateChapterNarrationUrl,
      ).toHaveBeenCalledWith(
        mockChapterId,
        `http://localhost:9000/smart-novel/tts-audio/${mockJobId}.mp3`,
      );
    });

    it('should log and drop a completed callback for an unknown/expired jobId', async () => {
      // Arrange
      vi.mocked(jobToChapterMap.get).mockReturnValue(undefined);
      const message = JSON.stringify({
        jobId: mockJobId,
        status: 'completed',
        fileSizeBytes: 4,
        attempt: 1,
      });

      // Act
      await (uut as any).handleStatusUpdate(message);

      // Assert
      expect(
        chapterRepository.updateChapterNarrationUrl,
      ).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(mockJobId),
        expect.any(Object),
      );
    });

    it.each(['queued', 'generating', 'uploading', 'failed'])(
      'should ignore a "%s" status callback',
      async (status) => {
        // Arrange
        const message = JSON.stringify({ jobId: mockJobId, status });

        // Act
        await (uut as any).handleStatusUpdate(message);

        // Assert
        expect(jobToChapterMap.get).not.toHaveBeenCalled();
        expect(
          chapterRepository.updateChapterNarrationUrl,
        ).not.toHaveBeenCalled();
      },
    );
  });
});
