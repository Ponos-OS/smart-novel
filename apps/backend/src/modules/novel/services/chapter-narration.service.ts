import type { ConfigType } from '@nestjs/config';

import { ChecksumAlgorithm, S3Client } from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Chapter, NarrationStatus } from '@prisma/client';
import axios from 'axios';
import { isEmpty } from 'class-validator';
import { PubSubEngine } from 'graphql-subscriptions';
import {
  CustomLoggerService,
  isNil,
  retryAsync,
  urlBuilder,
} from 'nestjs-backend-common';
import { Readable } from 'node:stream';

import { appConfigs } from '../../../app/configs/app.config';
import { BackgroundRunnerService } from '../../background-runner';
import { LlmClient } from '../../llm';
import {
  createChecksum,
  UploaderService,
} from '../../object-storage';
import { PrismaService } from '../../prisma';
import {
  CHAPTER_REPOSITORY,
  type IChapterRepository,
  type IJobToChapterMap,
  JOB_TO_CHAPTER_MAP,
} from '../interfaces';
import { PUBSUB_TOKEN } from '../providers';
import { ChapterNarrationResponse } from '../types';
import { chapterNarrationUpdateSubscriptionKey } from '../utils';
import { NarrationLockService } from './narration-lock.service';

@Injectable()
export class ChapterNarrationService {
  /**
   * @description Tracks in-flight TTS HTTP requests per chapter so a `forceRegenerate` call can cancel them. Aborting the AbortController causes the underlying HTTP request to be closed, which the piper-tts-rest-api service detects (`req.on('aborted')`) and uses to kill the piper/ffmpeg child processes.
   *
   * @todo ATM we don't bother sharing the abort-map across replicas because we don't need to, but it might be necessary in the future.
   * If force-regenerate lands on a different replica, we can't abort the old TTS HTTP call (it'll keep running uselessly until it finishes), but the Redis lock + DB status check guarantee the old job can't corrupt the new narration when it eventually tries to commit its results.
   */
  private readonly inFlightTtsRequests = new Map<
    string,
    AbortController
  >();

  constructor(
    private readonly s3Client: S3Client,
    private readonly logger: CustomLoggerService,
    private readonly narrationLockService: NarrationLockService,
    private readonly prisma: PrismaService,
    private readonly backgroundRunner: BackgroundRunnerService,
    @Inject(PUBSUB_TOKEN)
    private readonly pubSub: PubSubEngine,
    @Inject(CHAPTER_REPOSITORY)
    private readonly chapterRepository: IChapterRepository,
    @Inject(appConfigs.KEY)
    private readonly appConfig: ConfigType<typeof appConfigs>,
    private readonly llmClient: LlmClient,
    @Inject(JOB_TO_CHAPTER_MAP)
    private readonly jobToChapterMap: IJobToChapterMap,
  ) {}

  /**
   * @description
   * Reusable audio-regeneration entry point — the hook any mutation that saves chapter
   * content must call, so audio generation can never be forgotten. Kicks off a Beatrice
   * `generateAudio` job and remembers which chapter it belongs to via {@link jobToChapterMap},
   * so Step 2.1/2.2 can later persist the audio URL and route status updates.
   *
   * Beatrice being unavailable (or otherwise failing) must not fail the content save that
   * already committed — this only ever logs, never throws, so callers can fire-and-forget it.
   */
  async regenerateAudio(
    chapterId: string,
    content: string,
  ): Promise<void> {
    const genUploadUrl = urlBuilder(
      this.appConfig.BACKEND_INTERNAL_URL,
      'beatrice-callbacks',
      'gen-upload-url',
    );
    const statusCallbackUrl = urlBuilder(
      this.appConfig.BACKEND_INTERNAL_URL,
      'beatrice-callbacks',
      'status',
    );

    const [error, result] = await retryAsync(
      () =>
        this.llmClient.generateAudio(
          content,
          this.appConfig.BEATRICE_DEFAULT_VOICE,
          genUploadUrl,
          statusCallbackUrl,
        ),
      { retry: 0 },
    );

    if (error) {
      this.logger.error(
        `Failed to queue Beatrice generateAudio job for chapter ${chapterId}: ${error.message}`,
        { context: ChapterNarrationService.name, error },
      );

      return;
    }

    this.jobToChapterMap.set(result.generateAudio.jobId, chapterId);

    this.logger.debug(
      `Queued Beatrice generateAudio job ${result.generateAudio.jobId} for chapter ${chapterId}`,
      { context: ChapterNarrationService.name },
    );
  }

  /**
   * Entry point: Try to start generation, return current status
   */
  async startGeneration(
    chapterId: string,
    forceRegenerate = false,
  ): Promise<ChapterNarrationResponse> {
    return this.prisma.$transaction(async (tx) => {
      this.logger.debug(
        `Attempting to start narration generation for chapter ID (force generate: ${forceRegenerate}): ${chapterId}`,
        { context: ChapterNarrationService.name },
      );

      const chapter = await tx.chapter.findUnique({
        where: { id: chapterId },
        include: { content: true },
      });

      if (!chapter) {
        throw new BadRequestException('Chapter not found');
      }

      if (!forceRegenerate && this.doesNarrationExist(chapter)) {
        this.logger.debug(
          `Narration already exists for chapter ID: ${chapterId}`,
          { context: ChapterNarrationService.name },
        );

        return {
          status: NarrationStatus.READY,
          narrationUrl: chapter.narrationUrl,
        };
      }

      const oneHour = 60 * 60 * 1000;
      const lockKey = this.narrationLockService.getLockKey(chapterId);

      // On force-regenerate: if a generation is already in flight on this replica, cancel its TTS HTTP call so the piper-tts-rest-api kills its piper/ffmpeg child processes and frees a slot in its semaphore.
      // tryAcquire(forceRegenerate=true) below will then delete and re-take the Redis lock, so the old background job's eventual cleanup is a no-op (token mismatch on release; status-checked DB update).
      if (forceRegenerate) {
        this.cancelInFlightTts(chapterId);
      }

      const token = await this.narrationLockService.tryAcquire(
        lockKey,
        oneHour,
        forceRegenerate,
      );

      if (isNil(token)) {
        // Another process is already working on it
        return { status: NarrationStatus.PROCESSING };
      }

      // Double-check after lock (race condition prevention)
      const recheck = await tx.chapter.findUnique({
        where: { id: chapterId },
      });

      if (!forceRegenerate && recheck?.narrationUrl) {
        await this.narrationLockService.release(lockKey, token);
        return {
          status: NarrationStatus.READY,
          narrationUrl: recheck.narrationUrl,
        };
      }

      // If already processing (status check), don't start again (unless forcing)
      if (
        !forceRegenerate &&
        recheck?.narrationStatus === 'PROCESSING'
      ) {
        await this.narrationLockService.release(lockKey, token);
        return { status: NarrationStatus.PROCESSING };
      }

      if (isEmpty(chapter.content?.content)) {
        throw new BadRequestException(
          'Chapter has no content to narrate',
        );
      }

      // Mark as processing atomically
      await tx.chapter.update({
        where: { id: chapterId },
        data: { narrationStatus: 'PROCESSING' },
      });

      // Publish initial event
      await this.pubSub.publish(
        chapterNarrationUpdateSubscriptionKey(chapterId),
        {
          chapterNarrationUpdated: {
            chapterId,
            status: NarrationStatus.PROCESSING,
          },
        },
      );

      // Start background processing
      this.processInBackground(
        chapterId,
        chapter.content.content,
        lockKey,
        token,
      );

      return { status: NarrationStatus.PROCESSING };
    });
  }

  subscribeToChapterNarration(chapterId: string) {
    // Type assertion needed because PubSub types don't match exactly
    return this.pubSub.asyncIterableIterator(
      chapterNarrationUpdateSubscriptionKey(chapterId),
    );
  }

  private doesNarrationExist(chapter: Chapter) {
    return (
      chapter.narrationUrl && chapter.narrationStatus === 'READY'
    );
  }

  /**
   * @summary Cancels any in-flight TTS HTTP request for this chapter (on same replica).
   * @description When the HTTP request aborts, piper-tts-rest-api's `req.on('aborted')` handler kills the piper/ffmpeg child processes, freeing its semaphore.
   */
  private cancelInFlightTts(chapterId: string): void {
    const controller = this.inFlightTtsRequests.get(chapterId);

    if (isNil(controller)) {
      return;
    }

    this.logger.debug(
      `Force-regenerate: canceling in-flight TTS for chapter ${chapterId}`,
      { context: ChapterNarrationService.name },
    );

    controller.abort(
      new Error('Force-regenerate: canceling previous TTS request'),
    );
    this.inFlightTtsRequests.delete(chapterId);
  }

  /**
   * Background job: Generate TTS, upload to S3, update DB
   * Fire-and-forget (not awaited by mutation)
   */
  private processInBackground(
    chapterId: string,
    content: string,
    lockKey: string,
    token: string,
  ): void {
    this.backgroundRunner.run(async () => {
      let intentionallyCancelled = false;

      try {
        // Step 1: Call TTS service
        this.logger.log(
          `Starting TTS generation for chapter ${chapterId}`,
          { context: ChapterNarrationService.name },
        );

        const ttsResponse = await this.callTtsService(
          content,
          chapterId,
        );

        // Step 2: Stream to S3
        this.logger.log(
          `Uploading narration to S3 for chapter ${chapterId}`,
          { context: ChapterNarrationService.name },
        );

        const publicUrl = await this.uploadToObjectStorage(
          ttsResponse,
          chapterId,
        );

        // Step 3: Update DB atomically (with status check)
        const updated =
          await this.chapterRepository.updateChapterNarrationComplete(
            chapterId,
            publicUrl,
          );

        if (updated === 0) {
          this.logger.warn(
            `Chapter ${chapterId} was modified during processing, skipping update`,
            { context: ChapterNarrationService.name },
          );
          return;
        }

        // Step 4: Publish success event
        await this.pubSub.publish(
          chapterNarrationUpdateSubscriptionKey(chapterId),
          {
            chapterNarrationUpdated: {
              chapterId,
              status: NarrationStatus.READY,
              narrationUrl: publicUrl,
            },
          },
        );

        this.logger.log(
          `Successfully generated narration for chapter ${chapterId}`,
          { context: ChapterNarrationService.name },
        );
      } catch (error) {
        // Check if this error is from a force-regenerate cancellation
        if (
          error instanceof Error &&
          error.message?.includes('Force-regenerate')
        ) {
          intentionallyCancelled = true;

          this.logger.debug(
            `TTS generation for chapter ${chapterId} was intentionally cancelled (force-regenerate takeover)`,
            { context: ChapterNarrationService.name },
          );

          return; // Don't mark as FAILED; new generation is taking over
        }

        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to generate narration for chapter ${chapterId}: ${errorMessage}`,
          { context: ChapterNarrationService.name, error },
        );

        // Mark as failed in DB
        await this.chapterRepository.updateNarrationStatus(
          chapterId,
          NarrationStatus.FAILED,
        );

        // Publish failure event
        await this.pubSub.publish(
          chapterNarrationUpdateSubscriptionKey(chapterId),
          {
            chapterNarrationUpdated: {
              chapterId,
              status: NarrationStatus.FAILED,
              error: 'Failed to generate audio',
            },
          },
        );
      } finally {
        // Clean up in-flight tracking (only if not cancelled; cancellation
        // already deleted it)
        if (!intentionallyCancelled) {
          this.inFlightTtsRequests.delete(chapterId);
        }
        // Always release lock
        await this.narrationLockService.release(lockKey, token);
      }
    });
  }

  /**
   * @summary Call TTS service and return stream
   * @throws error (including intentional cancellation)
   */
  private async callTtsService(
    content: string,
    chapterId: string,
  ): Promise<Readable> {
    /** @description Time to First Byte/headers (30 seconds) */
    const TTFB_TIMEOUT_MS = 30_000;
    /** @description No data received for this long (30 seconds) */
    const IDLE_TIMEOUT_MS = 30_000;
    /** @description Absolute max duration (15 minutes) */
    const HARD_CAP_MS = 15 * 60_000;
    const controller = new AbortController();

    // Register controller so force-regenerate can cancel this request
    this.inFlightTtsRequests.set(chapterId, controller);

    const hardCapTimer = setTimeout(
      () => controller.abort(new Error('Hard cap exceeded')),
      HARD_CAP_MS,
    );

    /** @description Cancel TTFB if headers take too long */
    let ttfbTimer: NodeJS.Timeout | null = setTimeout(() => {
      controller.abort(new Error('TTFB timeout'));
    }, TTFB_TIMEOUT_MS);

    try {
      const response = await axios.post(
        this.appConfig.TTS_ENDPOINT,
        { text: content },
        {
          responseType: 'stream',
          timeout: 0,
          signal: controller.signal,
        },
      );

      // We have headers => clear TTFB timer
      if (ttfbTimer) {
        clearTimeout(ttfbTimer);
        ttfbTimer = null;
      }

      // Set up idle timeout that resets on every chunk
      const stream = response.data as Readable;
      let idleTimer: NodeJS.Timeout | null = setTimeout(() => {
        controller.abort(new Error('Idle timeout'));
      }, IDLE_TIMEOUT_MS);

      stream.on('data', () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
        idleTimer = setTimeout(
          () => controller.abort(new Error('Idle timeout')),
          IDLE_TIMEOUT_MS,
        );
      });

      // Clean up timers when stream completes or errors
      const cleanup = () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
        if (ttfbTimer) {
          clearTimeout(ttfbTimer);
        }
        clearTimeout(hardCapTimer);
      };
      stream.once('end', cleanup);
      stream.once('error', cleanup);

      this.logger.log(
        `TTS request initiated for chapter ${chapterId}`,
        { context: ChapterNarrationService.name },
      );

      return stream;
    } catch (error) {
      // Clean up registration on error
      this.inFlightTtsRequests.delete(chapterId);

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to call TTS service for chapter ${chapterId}: ${errorMessage}`,
        { context: ChapterNarrationService.name, error },
      );

      throw error;
    }
  }

  /**
   * Upload stream to object storage and return public URL
   */
  private async uploadToObjectStorage(
    stream: Readable,
    chapterId: string,
  ): Promise<string> {
    const filename = `chapter-${chapterId}.mp3`;
    const objectKey = `narrations/${filename}`;
    const uploader = new UploaderService(
      this.s3Client,
      filename,
      objectKey,
      this.appConfig.OBJECT_STORAGE_BUCKET,
      this.logger,
      ChecksumAlgorithm.CRC32,
    );

    const crc = createChecksum(ChecksumAlgorithm.CRC32);

    await new Promise<void>((resolve, reject) => {
      stream
        .on('data', async (chunk: Buffer) => {
          try {
            crc.update(chunk);
            await uploader.upload(
              new Uint8Array(
                chunk.buffer,
                chunk.byteOffset,
                chunk.length,
              ),
              false,
              '',
            );
          } catch (e) {
            reject(e);
          }
        })
        .on('end', async () => {
          try {
            const checksumBase64 = crc.digestBase64();
            await uploader.upload(
              new Uint8Array(0),
              true,
              checksumBase64,
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        })
        .on('error', async (err) => {
          try {
            await uploader.abortUpload();
          } catch {
            // Ignore abort errors
            // TODO: Retry abortion later.
          }
          reject(err);
        });
    });

    return urlBuilder(
      this.appConfig.OBJECT_STORAGE_PUBLIC_URL,
      this.appConfig.OBJECT_STORAGE_BUCKET,
      objectKey,
    );
  }
}
