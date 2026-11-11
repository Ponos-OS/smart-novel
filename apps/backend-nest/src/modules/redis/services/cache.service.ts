import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from 'nestjs-backend-common';
import { hostname } from 'os';

import { CachedValue, CacheResult } from '../redis.interface';
import { RedisService } from './redis.service';

@Injectable()
export class CacheService<T> {
  /**
   * @summary Tracks in-flight computations by cache key for local single-flight coalescing.
   *
   * @todo Scope: per Node.js process only (in-memory map).
   * In multi-instance deployments, different app instances do not share this map, so the same cache miss may still trigger duplicate LLM calls across instances until one instance writes the result to Redis.
   */
  private readonly inFlightRequests = new Map<
    string,
    Promise<CacheResult<T>>
  >();

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * @description
   * Get value from cache or compute it using the provided function. Implements single-flight pattern to prevent duplicate computations.
   */
  async getOrCompute(
    key: string,
    computeFn: () => Promise<T>,
    ttlMs: number,
  ): Promise<CacheResult<T>> {
    const result = await this.getFromCache(key);

    if (result) {
      return result;
    }

    if (this.inFlightRequests.has(key)) {
      const previousRequestResult =
        await this.inFlightRequests.get(key)!;

      return {
        ...previousRequestResult,
        coalesced: true,
      };
    }

    const promise = computeFn()
      .then(async (result) => {
        const cacheValue: CachedValue<T> = {
          data: result,
          metadata: {
            instanceId: hostname(),
            cachedAt: new Date().toISOString(),
          },
        };

        try {
          await this.redisService.set(
            key,
            JSON.stringify(cacheValue),
            Math.floor(ttlMs / 1000),
          );
        } catch {
          // Ignore storing data in cache
        }

        this.inFlightRequests.delete(key);

        return {
          data: result,
          cacheHit: false,
          coalesced: false,
        };
      })
      .catch((error) => {
        this.logger.error(
          `Failed to compute/cache value for "${key}"`,
          { context: CacheService.name, error },
        );
        this.inFlightRequests.delete(key);
        throw error;
      });

    this.inFlightRequests.set(key, promise);

    return promise;
  }

  async invalidate(key: string): Promise<void> {
    await this.redisService.del(key);
    this.inFlightRequests.delete(key);
  }

  private async getFromCache(
    key: string,
  ): Promise<CacheResult<T> | null> {
    try {
      const cached = await this.redisService.get(key);

      if (!cached) {
        return null;
      }

      const parsedCache: CachedValue<T> = JSON.parse(cached);

      return {
        data: parsedCache.data,
        cacheHit: true,
        coalesced: false,
      };
    } catch {
      this.logger.error(
        `Failed to get/parse cache for key "${key}"`,
        { context: CacheService.name },
      );
      // Ignore cache errors
    }
    return null;
  }
}
