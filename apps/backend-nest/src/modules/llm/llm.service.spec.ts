import { ConfigType } from '@nestjs/config';
import { CustomLoggerService } from 'nestjs-backend-common';

import { appConfigs } from '../../app';
import { CacheService } from '../redis';
import { LlmClient } from './llm.client';
import { ExplainWordPayload, LlmService } from './llm.service';

describe(LlmService.name, () => {
  let uut: LlmService;
  let appConfig: ConfigType<typeof appConfigs>;
  let logger: CustomLoggerService;
  let cacheService: CacheService<ExplainWordPayload>;
  let llmClient: LlmClient;

  beforeEach(() => {
    const explainedWord: ExplainWordPayload = {
      meaning: 'lasting for a very short time',
      simplifiedExplanation:
        'Something that is ephemeral lasts for a very short time.',
      synonyms: ['transient'],
      antonyms: ['permanent'],
    };
    appConfig = {
      LLM_CACHE_TTL: '1h',
    } as any;
    logger = {
      log: vi.fn(),
    } as any;
    cacheService = {
      getOrCompute: vi.fn().mockResolvedValue({
        data: explainedWord,
        cacheHit: false,
        coalesced: false,
      }),
      invalidate: vi.fn(),
    } as any;
    llmClient = {
      explainWord: vi.fn().mockResolvedValue({
        explainWord: explainedWord,
      }),
      normalizeTextForTts: vi.fn(),
    } as any;

    uut = new LlmService(appConfig, logger, cacheService, llmClient);
  });

  it('should explain a word', async () => {
    const res = await uut.explainWord(
      'ephemeral',
      'Fame in the world of rock and pop is largely ephemeral.',
    );

    expect(res).toStrictEqual({
      meaning: 'lasting for a very short time',
      simplifiedExplanation:
        'Something that is ephemeral lasts for a very short time.',
      synonyms: ['transient'],
      antonyms: ['permanent'],
      cacheKey: expect.any(String),
    });
  });

  it('should explain a word and hit the cache', async () => {
    vi.mocked(cacheService.getOrCompute).mockResolvedValueOnce({
      data: {
        meaning: 'lasting for a very short time',
        simplifiedExplanation:
          'Something that is ephemeral lasts for a very short time.',
        synonyms: ['transient'],
        antonyms: ['permanent'],
      },
      cacheHit: true,
      coalesced: false,
    });

    const res = await uut.explainWord(
      'ephemeral',
      'Fame in the world of rock and pop is largely ephemeral.',
    );

    expect(res).toBeObject();
    expect(cacheService.getOrCompute).toHaveBeenCalledTimes(1);
  });
});
