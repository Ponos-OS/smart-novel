import type { CustomLoggerService } from 'nestjs-backend-common';

import { LicenseSourceType } from '@prisma/client';
import { LICENSE_ASSISTANT_RATE_LIMITED } from '@smart-novel/shared';

import type { RedisService } from '../redis';

import {
  type FitharaClient,
  FitharaRequestError,
} from '../../shared';
import { MAX_REQUESTS_PER_USER_PER_HOUR } from './constants';
import { LicenseAssistantService } from './license-assistant.service';
import { LicenseAssistantMessageRole } from './types';

describe(LicenseAssistantService.name, () => {
  let uut: LicenseAssistantService;
  let fithara: FitharaClient;
  let redis: RedisService;
  let logger: CustomLoggerService;

  const userId = '230104087265432001';
  const ccByDraft = {
    title: 'Creative Commons Attribution 4.0 International',
    text: '# Creative Commons Attribution 4.0 International',
    source: {
      type: LicenseSourceType.CANONICAL,
      canonicalId: 'CC-BY-4.0',
    },
  };
  const fitharaResponse = {
    assistantMessage: 'I changed section 3 to forbid resale.',
    draft: {
      title: 'CC BY 4.0 without resale',
      text: '# CC BY 4.0 without resale',
      source: { type: 'forked', canonicalId: 'CC-BY-4.0' },
    },
    draftChanged: true,
    recommendations: ['CC-BY-NC-4.0'],
    disclaimers: ['This is not legal advice.'],
    isReadyToFinalize: false,
    conversation: [
      {
        role: 'assistant',
        content:
          'Summary of the earlier conversation:\nThe author writes novels.',
      },
      { role: 'user', content: 'Forbid resale please.' },
      {
        role: 'assistant',
        content: 'I changed section 3 to forbid resale.',
      },
    ],
  };

  beforeEach(() => {
    fithara = {
      draft: vi.fn().mockResolvedValue(fitharaResponse),
      listLicenses: vi.fn(),
      getLicense: vi.fn(),
    } as any;
    redis = { increment: vi.fn().mockResolvedValue(1) } as any;
    logger = { warn: vi.fn() } as any;

    uut = new LicenseAssistantService(fithara, redis, logger);
  });

  describe('draft', () => {
    it('should forward the conversation and the draft of the caller and return the conversation Fithara sends back', async () => {
      const result = await uut.draft(userId, {
        conversation: [
          {
            role: LicenseAssistantMessageRole.USER,
            content: 'I want a license for my novel.',
          },
          {
            role: LicenseAssistantMessageRole.ASSISTANT,
            content: 'Do you allow remixing?',
          },
        ],
        draft: ccByDraft,
        message: 'Forbid resale please.',
        preferences: { category: 'creative_commons' },
      });

      expect(fithara.draft).toHaveBeenCalledWith({
        message: 'Forbid resale please.',
        preferences: { category: 'creative_commons' },
        conversation: [
          { role: 'user', content: 'I want a license for my novel.' },
          { role: 'assistant', content: 'Do you allow remixing?' },
        ],
        draft: {
          title: ccByDraft.title,
          text: ccByDraft.text,
          source: { type: 'canonical', canonicalId: 'CC-BY-4.0' },
        },
      });
      expect(result).toEqual({
        assistantMessage: fitharaResponse.assistantMessage,
        draft: {
          title: 'CC BY 4.0 without resale',
          text: '# CC BY 4.0 without resale',
          source: {
            type: LicenseSourceType.FORKED,
            canonicalId: 'CC-BY-4.0',
          },
        },
        draftChanged: true,
        recommendations: ['CC-BY-NC-4.0'],
        disclaimers: ['This is not legal advice.'],
        isReadyToFinalize: false,
        conversation: [
          {
            role: LicenseAssistantMessageRole.ASSISTANT,
            content:
              'Summary of the earlier conversation:\nThe author writes novels.',
          },
          {
            role: LicenseAssistantMessageRole.USER,
            content: 'Forbid resale please.',
          },
          {
            role: LicenseAssistantMessageRole.ASSISTANT,
            content: 'I changed section 3 to forbid resale.',
          },
        ],
      });
    });

    it('should start a new conversation with no draft and no preferences', async () => {
      await uut.draft(userId, {
        conversation: [],
        message: 'What license fits a free web novel?',
      });

      expect(fithara.draft).toHaveBeenCalledWith({
        message: 'What license fits a free web novel?',
        preferences: null,
        conversation: [],
        draft: null,
      });
    });

    it('should return no draft when the assistant returns none', async () => {
      vi.mocked(fithara.draft).mockResolvedValue({
        ...fitharaResponse,
        draft: null,
        draftChanged: false,
      } as any);

      const result = await uut.draft(userId, {
        conversation: [],
        message: 'Which license is popular?',
      });

      expect(result.draft).toBeNull();
      expect(result.draftChanged).toBeFalse();
    });

    it('should count the request of the caller in a one-hour window', async () => {
      await uut.draft(userId, { conversation: [], message: 'Hello' });

      expect(redis.increment).toHaveBeenCalledWith(
        `license-assistant:requests:${userId}`,
        3600,
      );
    });

    it('should refuse a user over the hourly limit before calling Fithara', async () => {
      vi.mocked(redis.increment).mockResolvedValue(
        MAX_REQUESTS_PER_USER_PER_HOUR + 1,
      );

      const result = uut.draft(userId, {
        conversation: [],
        message: 'One more question',
      });

      await expect(result).rejects.toMatchObject({
        extensions: {
          code: LICENSE_ASSISTANT_RATE_LIMITED,
          status: 429,
        },
      });
      expect(fithara.draft).not.toHaveBeenCalled();
    });

    it('should let the last allowed request through', async () => {
      vi.mocked(redis.increment).mockResolvedValue(
        MAX_REQUESTS_PER_USER_PER_HOUR,
      );

      const result = await uut.draft(userId, {
        conversation: [],
        message: 'The last one',
      });

      expect(result.assistantMessage).toBe(
        fitharaResponse.assistantMessage,
      );
    });

    it('should skip the limit and log when Redis is down', async () => {
      vi.mocked(redis.increment).mockRejectedValue(
        new Error('connection refused'),
      );

      const result = await uut.draft(userId, {
        conversation: [],
        message: 'Hello',
      });

      expect(result.assistantMessage).toBe(
        fitharaResponse.assistantMessage,
      );
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('should log and map a Fithara failure', async () => {
      vi.mocked(fithara.draft).mockRejectedValue(
        new FitharaRequestError(
          'LLM is down',
          503,
          'LLM_UNAVAILABLE',
          'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        ),
      );

      const result = uut.draft(userId, {
        conversation: [],
        message: 'Hello',
      });

      await expect(result).rejects.toMatchObject({
        extensions: {
          code: 'LICENSE_ASSISTANT_UNAVAILABLE',
          requestId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        },
      });
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });

  describe('listCanonicalLicenses', () => {
    it('should return the licenses of the registry', async () => {
      const licenses = [{ id: 'CC-BY-4.0', shortName: 'CC BY 4.0' }];
      vi.mocked(fithara.listLicenses).mockResolvedValue({
        licenses,
      } as any);

      const result = await uut.listCanonicalLicenses();

      expect(result).toBe(licenses);
    });

    it('should map an unknown license to a not-found error', async () => {
      vi.mocked(fithara.getLicense).mockRejectedValue(
        new FitharaRequestError(
          'No such license',
          404,
          'UNKNOWN_LICENSE',
        ),
      );

      const result = uut.getCanonicalLicense('MIT-0');

      await expect(result).rejects.toMatchObject({
        extensions: {
          code: 'CANONICAL_LICENSE_NOT_FOUND',
          status: 404,
        },
      });
    });
  });
});
