import type { ConfigType } from '@nestjs/config';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { NarrationStatus } from '@prisma/client';
import { isEmpty } from 'class-validator';
import { PubSubEngine } from 'graphql-subscriptions';
import {
  CustomLoggerService,
  isNil,
  retryAsync,
  urlBuilder,
} from 'nestjs-backend-common';

import { appConfigs } from '../../../app/configs/app.config';
import { LlmClient } from '../../llm';
import { RedisService } from '../../redis';
import {
  isBeatriceTerminal,
  isBeatriceTerminalFailure,
  isBeatriceTerminalSuccess,
  isKnownBeatriceStatus,
  TTS_AUDIO_OBJECT_KEY_PREFIX,
  TTS_STATUS_CHANNEL,
  TtsStatusCallbackDto,
} from '../../tts-callbacks';
import {
  CHAPTER_CONTENT_REPOSITORY,
  CHAPTER_REPOSITORY,
  type IChapterContentRepository,
  type IChapterRepository,
} from '../interfaces';
import { PUBSUB_TOKEN } from '../providers';
import { ChapterNarrationResponse } from '../types';
import { chapterNarrationUpdateSubscriptionKey } from '../utils';
import { NarrationLockService } from './narration-lock.service';

@Injectable()
export class ChapterNarrationService implements OnModuleInit {
  private static readonly LOCK_TTL_MS = 60 * 60 * 1000;

  /**
   * @description Tracks the narration lock (key + token) held for each in-flight Beatrice
   * job, so {@link handleStatusUpdate} can release it once the job reaches a terminal
   * status (`completed`/`failed`) — the lock can't be released right after queuing, since
   * Beatrice's `generateAudio` only kicks the job off; the actual work finishes later,
   * asynchronously, off the status callback.
   */
  private readonly jobLockTokens = new Map<
    string,
    { lockKey: string; token: string }
  >();

  /**
   * @description
   * Tracks per-job ordering state so {@link handleStatusUpdate} can drop a callback that
   * arrives out of order — Beatrice's `queued` (sent synchronously from `generateAudio`)
   * and `generating` (sent independently by its worker) callbacks race each other over the
   * network with no ordering guarantee. `progress` only ever means "a bigger number is
   * later for this job," nothing else. Same in-memory durability tradeoff as
   * `jobLockTokens` (lost on backend restart).
   */
  private readonly jobProgressState = new Map<
    string,
    { lastSeen: number; terminal: boolean }
  >();

  constructor(
    private readonly logger: CustomLoggerService,
    private readonly narrationLockService: NarrationLockService,
    @Inject(PUBSUB_TOKEN)
    private readonly pubSub: PubSubEngine,
    @Inject(CHAPTER_REPOSITORY)
    private readonly chapterRepository: IChapterRepository,
    @Inject(CHAPTER_CONTENT_REPOSITORY)
    private readonly chapterContentRepository: IChapterContentRepository,
    @Inject(appConfigs.KEY)
    private readonly appConfig: ConfigType<typeof appConfigs>,
    private readonly llmClient: LlmClient,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.redisService.subscribe(
      TTS_STATUS_CHANNEL,
      (message) => void this.handleStatusUpdate(message),
    );
  }

  /**
   * @description
   * Reacts to every Beatrice `statusCallbackUrl` update: the chapter it belongs to comes
   * straight from `clientContextId` (we always pass the chapterId as `clientContextId` on
   * `generateAudio`, Step 5), present from the very first `queued` callback — no lookup,
   * so no race against when the `generateAudio` mutation response happens to arrive back.
   * On `completed`, persists the deterministic audio URL built in Step 1b
   * (`narrations/<jobId>.mp3`) (Step 2.1), and re-publishes the update onto the GraphQL
   * `PubSub` so `chapterNarrationUpdated` fires with live progress (Step 2.2). A callback
   * missing `clientContextId` (e.g. a job queued by a pre-upgrade backend, still in-flight
   * during a deploy) is logged and dropped, not thrown — this runs off a best-effort
   * pub/sub channel, not a request that can report an error back to a caller.
   */
  private async handleStatusUpdate(message: string): Promise<void> {
    const update = JSON.parse(message) as TtsStatusCallbackDto;
    const chapterId = update.clientContextId;

    if (isNil(chapterId)) {
      this.logger.warn(
        `Received "${update.status}" status for job ${update.jobId} with no clientContextId, dropping`,
        { context: ChapterNarrationService.name },
      );

      return;
    }

    if (!this.shouldApplyStatusUpdate(update)) {
      return;
    }

    if (!isKnownBeatriceStatus(update.status)) {
      this.logger.warn(
        `Received unrecognized Beatrice status "${update.status}" for job ${update.jobId} — treating as in-progress; Beatrice's status vocabulary may have changed`,
        { context: ChapterNarrationService.name },
      );
    }

    let narrationUrl: string | undefined;

    if (isBeatriceTerminalSuccess(update.status)) {
      narrationUrl = urlBuilder(
        this.appConfig.OBJECT_STORAGE_PUBLIC_URL,
        this.appConfig.OBJECT_STORAGE_BUCKET,
        `${TTS_AUDIO_OBJECT_KEY_PREFIX}/${update.jobId}.mp3`,
      );

      await this.chapterRepository.updateChapterNarrationUrl(
        chapterId,
        narrationUrl,
      );

      this.logger.debug(
        `Persisted audio URL for chapter ${chapterId} (job ${update.jobId})`,
        { context: ChapterNarrationService.name },
      );
    }

    if (isBeatriceTerminalFailure(update.status)) {
      this.logger.error(
        `Beatrice reported job ${update.jobId} for chapter ${chapterId} as failed: ${update.error?.code ?? 'UNKNOWN'}: ${update.error?.message ?? 'no error details'}`,
        { context: ChapterNarrationService.name },
      );
    }

    if (isBeatriceTerminal(update.status)) {
      await this.releaseJobLock(update.jobId);
    }

    const status = this.mapBeatriceStatus(update.status);

    await this.pubSub.publish(
      chapterNarrationUpdateSubscriptionKey(chapterId),
      {
        chapterNarrationUpdated: {
          chapterId,
          status,
          narrationUrl,
          stage:
            status === NarrationStatus.PROCESSING
              ? update.status
              : undefined,
          error: update.error
            ? `${update.error.code}: ${update.error.message}`
            : undefined,
        },
      },
    );
  }

  /**
   * @description
   * Enforces per-job callback ordering. Beatrice's `queued` (sent synchronously from
   * `generateAudio`) and `generating` (sent independently by its worker) callbacks race
   * each other over the network with no ordering guarantee, so a `progress` no higher than
   * what's already been seen for this job is stale and must be dropped. Once a job reaches
   * a terminal status, every later callback for it is dropped too, whatever caused it to
   * arrive late — the terminal marker is kept in the map rather than removed (unlike
   * `jobLockTokens`'s cleanup on the same transition): deleting it would make a late
   * non-terminal retry look like a brand-new job and let it slip through and republish.
   */
  private shouldApplyStatusUpdate(
    update: TtsStatusCallbackDto,
  ): boolean {
    const state = this.jobProgressState.get(update.jobId);

    if (state?.terminal) {
      this.logger.debug(
        `Dropping "${update.status}" callback for job ${update.jobId}: already reached a terminal status`,
        { context: ChapterNarrationService.name },
      );

      return false;
    }

    if (isBeatriceTerminal(update.status)) {
      this.jobProgressState.set(update.jobId, {
        lastSeen: state?.lastSeen ?? 0,
        terminal: true,
      });

      return true;
    }

    if (update.progress === undefined) {
      return true;
    }

    const lastSeen = state?.lastSeen ?? 0;

    if (update.progress <= lastSeen) {
      this.logger.debug(
        `Dropping stale "${update.status}" callback for job ${update.jobId}: progress ${update.progress} <= last seen ${lastSeen}`,
        { context: ChapterNarrationService.name },
      );

      return false;
    }

    this.jobProgressState.set(update.jobId, {
      lastSeen: update.progress,
      terminal: false,
    });

    return true;
  }

  /**
   * @description
   * The anti-corruption layer's other half: collapses Beatrice's open-ended status string
   * onto the backend's own, strongly-typed `NarrationStatus` — anything that isn't a
   * recognized terminal status (including a stage Beatrice hasn't invented yet) falls
   * through to PROCESSING, so an unrecognized status degrades gracefully instead of
   * throwing. See `.github/docs/anti-corruption-layer-beatrice-tts.md`.
   */
  private mapBeatriceStatus(status: string): NarrationStatus {
    if (isBeatriceTerminalSuccess(status)) {
      return NarrationStatus.READY;
    }

    if (isBeatriceTerminalFailure(status)) {
      return NarrationStatus.FAILED;
    }

    return NarrationStatus.PROCESSING;
  }

  /**
   * @description
   * Reusable audio-regeneration entry point — the hook any mutation that saves chapter
   * content must call, so audio generation can never be forgotten. Tries to acquire the
   * narration lock and, if held (a generation is already in flight for this chapter —
   * e.g. the user just clicked "Generate TTS"), skips silently: the content save that
   * already committed must not fail because of this side effect, and a duplicate job
   * would just race the one already running.
   *
   * Beatrice being unavailable (or otherwise failing) must not fail the content save
   * either — this only ever logs, never throws, so callers can fire-and-forget it.
   */
  async regenerateAudio(
    chapterId: string,
    content: string,
    authorization: string,
  ): Promise<void> {
    const lockKey = this.narrationLockService.getLockKey(chapterId);
    const token = await this.narrationLockService.tryAcquire(
      lockKey,
      ChapterNarrationService.LOCK_TTL_MS,
    );

    if (isNil(token)) {
      this.logger.debug(
        `Narration generation already in progress for chapter ${chapterId}, skipping auto-regeneration`,
        { context: ChapterNarrationService.name },
      );

      return;
    }

    await this.queueBeatriceJob(
      chapterId,
      content,
      lockKey,
      token,
      authorization,
    );
  }

  /**
   * @description
   * Entry point for the explicit "Generate TTS" button (`generateChapterAudio` mutation).
   * Always (re)generates a fresh audio file via Beatrice — there's no more force/normal
   * distinction, generation always starts fresh. The only thing that can block it is a
   * generation already in flight for this chapter (the narration lock), which is rejected
   * with a clear error instead of silently overwriting or queueing behind it.
   */
  async generateChapterAudio(
    chapterId: string,
    authorization: string,
  ): Promise<ChapterNarrationResponse> {
    const chapter = await this.chapterRepository.findById(chapterId);

    if (!chapter) {
      throw new BadRequestException('Chapter not found');
    }

    const chapterContent =
      await this.chapterContentRepository.findByChapterId(chapterId);

    if (isEmpty(chapterContent.content)) {
      throw new BadRequestException(
        'Chapter has no content to narrate',
      );
    }

    const lockKey = this.narrationLockService.getLockKey(chapterId);
    const token = await this.narrationLockService.tryAcquire(
      lockKey,
      ChapterNarrationService.LOCK_TTL_MS,
    );

    if (isNil(token)) {
      throw new ConflictException(
        'Narration generation is already in progress for this chapter',
      );
    }

    await this.queueBeatriceJob(
      chapterId,
      chapterContent.content,
      lockKey,
      token,
      authorization,
    );

    return { status: NarrationStatus.PROCESSING };
  }

  subscribeToChapterNarration(chapterId: string) {
    // Type assertion needed because PubSub types don't match exactly
    return this.pubSub.asyncIterableIterator(
      chapterNarrationUpdateSubscriptionKey(chapterId),
    );
  }

  /**
   * @description Calls Beatrice's `generateAudio`, holding the already-acquired narration
   * lock open until the job reaches a terminal status (released in
   * {@link handleStatusUpdate}) — or releasing it immediately if Beatrice itself couldn't
   * be reached, since no job means nothing will ever call back to release it later.
   */
  private async queueBeatriceJob(
    chapterId: string,
    content: string,
    lockKey: string,
    token: string,
    authorization: string,
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
          chapterId,
          authorization,
        ),
      { retry: 0 },
    );

    if (error) {
      await this.narrationLockService.release(lockKey, token);

      this.logger.error(
        `Failed to queue Beatrice generateAudio job for chapter ${chapterId}: ${error.message}`,
        { context: ChapterNarrationService.name, error },
      );

      return;
    }

    const jobId = result.generateAudio.jobId;

    this.jobLockTokens.set(jobId, { lockKey, token });

    this.logger.debug(
      `Queued Beatrice generateAudio job ${jobId} for chapter ${chapterId}`,
      { context: ChapterNarrationService.name },
    );
  }

  /**
   * @description Releases the narration lock held for a job, if any — a no-op for a job
   * this replica never queued (e.g. an unmapped/expired jobId never had a lock recorded).
   */
  private async releaseJobLock(jobId: string): Promise<void> {
    const lock = this.jobLockTokens.get(jobId);

    if (!lock) {
      return;
    }

    await this.narrationLockService.release(lock.lockKey, lock.token);
    this.jobLockTokens.delete(jobId);
  }
}
