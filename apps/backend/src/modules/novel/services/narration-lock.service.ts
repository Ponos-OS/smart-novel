import { Injectable } from '@nestjs/common';

import { RedisService } from '../../redis';

@Injectable()
export class NarrationLockService {
  constructor(private readonly redisService: RedisService) {}

  getLockKey(chapterId: string) {
    return `chapter_tts:${chapterId}`;
  }

  async exists(lockKey: string): Promise<boolean> {
    const value = await this.redisService.get(lockKey);

    return value !== null;
  }

  /**
   * @description tries to acquire a lock.
   * @returns a token if lock acquired, or null otherwise.
   */
  async tryAcquire(
    key: string,
    ttlMs: number,
  ): Promise<string | null> {
    const token = Math.random().toString(36).slice(2);
    // Sets TTL using SET NX PX.
    const res = await this.redisService.set(key, token, {
      ttlMs,
      nx: true,
    });

    return res ? token : null;
  }

  /**
   * @description Release lock only if token matches.
   */
  async release(key: string, token: string | null) {
    if (!token) {
      return;
    }

    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end`;

    await this.redisService.evaluate(script, 1, key, token);
  }
}
