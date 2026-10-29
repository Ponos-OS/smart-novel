import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PLATFORM_TERMS_VERSION_MISMATCH } from '@smart-novel/shared';
import { GraphQLError } from 'graphql';
import {
  CustomLoggerService,
  retryAsync,
} from 'nestjs-backend-common';

import { PrismaService } from '../prisma';
import { RedisService } from '../redis';
import {
  ACCEPTED_CACHE_TTL_SECONDS,
  PLATFORM_TERMS,
} from './platform-terms.constants';
import { PlatformTerms, PlatformTermsStatus } from './types';

@Injectable()
export class PlatformTermsService {
  constructor(
    @Inject(PLATFORM_TERMS) private readonly terms: PlatformTerms,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly logger: CustomLoggerService,
  ) {}

  getCurrent(): PlatformTerms {
    return this.terms;
  }

  async getStatus(userId: string): Promise<PlatformTermsStatus> {
    const acceptances =
      await this.prisma.platformTermsAcceptance.findMany({
        where: { userId },
        select: { termsVersion: true },
      });
    const versions = acceptances.map(
      ({ termsVersion }) => termsVersion,
    );

    return {
      requiredVersion: this.terms.version,
      acceptedVersion: versions.length ? Math.max(...versions) : null,
      accepted: versions.includes(this.terms.version),
    };
  }

  /**
   * @description Only the accepted state is cached, so a stale or lost entry can never grant access. A Redis failure falls back to the database.
   */
  async hasAcceptedCurrent(userId: string): Promise<boolean> {
    const key = this.buildCacheKey(userId);
    const [cacheError, cached] = await retryAsync(
      () => this.redis.get(key),
      { retry: 0 },
    );

    if (cacheError) {
      this.logger.warn(
        `Could not read ${key} from Redis: ${cacheError.message}`,
      );
    }
    if (cached) {
      return true;
    }

    const acceptance =
      await this.prisma.platformTermsAcceptance.findUnique({
        where: {
          userId_termsVersion: {
            userId,
            termsVersion: this.terms.version,
          },
        },
        select: { id: true },
      });

    if (!acceptance) {
      return false;
    }

    await this.cacheAccepted(key);

    return true;
  }

  async accept(
    userId: string,
    version: number,
  ): Promise<PlatformTermsStatus> {
    if (version !== this.terms.version) {
      throw new GraphQLError(
        `The platform terms are at version ${this.terms.version}, not ${version}. Reload them before accepting.`,
        {
          extensions: {
            code: PLATFORM_TERMS_VERSION_MISMATCH,
            status: HttpStatus.BAD_REQUEST,
          },
        },
      );
    }

    await this.prisma.platformTermsAcceptance.createMany({
      data: [{ userId, termsVersion: version }],
      skipDuplicates: true,
    });
    await this.cacheAccepted(this.buildCacheKey(userId));

    return this.getStatus(userId);
  }

  private buildCacheKey(userId: string): string {
    return `platform-terms:accepted:${userId}:${this.terms.version}`;
  }

  private async cacheAccepted(key: string): Promise<void> {
    const [error] = await retryAsync(
      () => this.redis.set(key, '1', ACCEPTED_CACHE_TTL_SECONDS),
      { retry: 0 },
    );

    if (error) {
      this.logger.warn(
        `Could not cache ${key} in Redis: ${error.message}`,
      );
    }
  }
}
