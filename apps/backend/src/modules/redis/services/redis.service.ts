import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { isBoolean, isNumber } from 'class-validator';
import { Command, Redis } from 'ioredis';
import { CustomLoggerService, isNil } from 'nestjs-backend-common';

import { RedisSetArg, RedisSetOptions } from '../redis.interface';
import {
  MODULE_OPTIONS_TOKEN,
  type RedisModuleOptions,
} from '../redis.module-definition';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: RedisModuleOptions,
    private readonly logger: CustomLoggerService,
  ) {
    this.client = new Redis(this.options.redisUrl, {
      password: this.options.redisPassword,
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected', {
        context: RedisService.name,
      });
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis client error: ${error.message}`, {
        context: RedisService.name,
        error,
      });
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed', {
        context: RedisService.name,
      });
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis client disconnected', {
      context: RedisService.name,
    });
  }

  /**
   * Get a value from Redis by key
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<boolean>;
  async set(
    key: string,
    value: string,
    options?: RedisSetOptions,
  ): Promise<boolean>;
  async set(
    key: string,
    value: string,
    ttlOrOptions?: number | RedisSetOptions,
  ): Promise<boolean> {
    const opts: RedisSetOptions = isNumber(ttlOrOptions)
      ? { ttlSeconds: ttlOrOptions }
      : (ttlOrOptions ?? {});

    if (!isNil(opts.ttlSeconds) && !isNil(opts.ttlMs)) {
      throw new Error(
        'Provide either ttlSeconds (EX) or ttlMs (PX), not both.',
      );
    }

    if (!isNil(opts.nx) && !isNil(opts.xx)) {
      throw new Error('Provide either nx or xx, not both.');
    }

    if (isNil(opts.nx) && isNil(opts.xx) && isNil(opts.ttlMs)) {
      if (!isNil(opts.ttlSeconds)) {
        await this.client.setex(key, opts.ttlSeconds, value);

        return true;
      }

      await this.client.set(key, value);
      return true;
    }

    const args: RedisSetArg[] = [];

    if (!isNil(opts.ttlMs)) {
      args.push('PX', opts.ttlMs);
    } else if (!isNil(opts.ttlSeconds)) {
      args.push('EX', opts.ttlSeconds);
    }

    if (isBoolean(opts.nx) && opts.nx) {
      args.push('NX');
    }
    if (isBoolean(opts.xx) && opts.xx) {
      args.push('XX');
    }

    // Using sendCommand to support dynamic args, since ioredis doesn't have a good typed method for this combination.
    const rawResult = (await this.client.sendCommand(
      new Command('SET', [key, value, ...args]),
    )) as Buffer | undefined;

    if (isNil(rawResult)) {
      return false;
    }

    const result = rawResult.toString();

    if (result !== 'OK') {
      this.logger.warn(
        `Failed to set key "${key}" with options ${JSON.stringify(opts)}`,
        {
          context: RedisService.name,
        },
      );

      return false;
    }

    return true;
  }

  /**
   * @description Publish a message on a Redis pub/sub channel
   * @returns the number of subscribers that received the message
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  /**
   * @description Delete a key from Redis
   * @returns `true` if the key was deleted, `false` if the key did not exist
   */
  async del(key: string): Promise<boolean> {
    const result = await this.client.del(key);

    if (result === 0) {
      return false;
    }
    return true;
  }

  /**
   * @description Evaluate a Lua script in Redis
   * @param script the Lua program as a string
   * @param numKeys how many of the following arguments are keys
   */
  evaluate(
    script: string,
    numKeys: number,
    key: string,
    token: string,
  ) {
    return this.client.eval(script, numKeys, key, token);
  }
}
