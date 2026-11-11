import type { ConfigType } from '@nestjs/config';

import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import { CustomLoggerService } from 'nestjs-backend-common';
import { hostname } from 'os';

import { appConfigs } from '../../app/configs/app.config';
import { generateCacheKey } from '../../shared';
import { CacheService } from '../redis';
import { LlmClient } from './llm.client';
import { WordExplanation } from './types';

export type ExplainWordPayload = Awaited<
  ReturnType<LlmClient['explainWord']>
>['explainWord'];

@Injectable()
export class LlmService {
  constructor(
    @Inject(appConfigs.KEY)
    private readonly appConfig: ConfigType<typeof appConfigs>,
    private readonly logger: CustomLoggerService,
    private readonly cacheService: CacheService<ExplainWordPayload>,
    private readonly llmClient: LlmClient,
  ) {}

  async explainWord(
    word: string,
    context: string,
  ): Promise<WordExplanation> {
    const startTime = Date.now();
    const cacheKey = generateCacheKey(word, context);
    const cacheTtlMs = ms(this.appConfig.LLM_CACHE_TTL);
    const { data, cacheHit, coalesced } =
      await this.cacheService.getOrCompute(
        cacheKey,
        async () => {
          const { explainWord } = await this.llmClient.explainWord(
            word,
            context,
          );
          return explainWord;
        },
        cacheTtlMs,
      );
    const totalLatency = Date.now() - startTime;

    // Log LLM observability
    this.logger.log(`LLM call completed for word "${word}"`, {
      context: LlmService.name,
      cacheKey,
      word,
      instanceId: hostname(),
      latencyMs: totalLatency,
      cacheHit,
      coalesced,
      telemetryOf: 'LlmObservability',
    });

    return {
      ...data,
      cacheKey,
    };
  }
}
