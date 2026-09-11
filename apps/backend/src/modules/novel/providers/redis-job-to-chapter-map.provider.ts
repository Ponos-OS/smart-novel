import { Injectable } from '@nestjs/common';

import { RedisService } from '../../redis';
import { IJobToChapterMap } from '../interfaces';

/**
 * @description
 * Redis-backed implementation of {@link IJobToChapterMap}, so the mapping survives a
 * backend process restart (e.g. the dev `nx` watcher reloading mid-job) instead of being
 * lost with an in-memory `Map`. Entries expire after {@link RedisJobToChapterMap.TTL_SECONDS},
 * matching how long a narration lock is held (`ChapterNarrationService.LOCK_TTL_MS`), so a
 * job that never calls back doesn't leak a key forever.
 */
@Injectable()
export class RedisJobToChapterMap implements IJobToChapterMap {
  private static readonly TTL_SECONDS = 60 * 60;

  constructor(private readonly redisService: RedisService) {}

  async set(jobId: string, chapterId: string): Promise<void> {
    await this.redisService.set(this.getKey(jobId), chapterId, {
      ttlSeconds: RedisJobToChapterMap.TTL_SECONDS,
    });
  }

  async get(jobId: string): Promise<string | undefined> {
    const chapterId = await this.redisService.get(this.getKey(jobId));

    return chapterId ?? undefined;
  }

  private getKey(jobId: string): string {
    return `tts_job_chapter:${jobId}`;
  }
}
