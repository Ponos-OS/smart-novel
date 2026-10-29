import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { LICENSE_ASSISTANT_RATE_LIMITED } from '@smart-novel/shared';
import { GraphQLError } from 'graphql';
import {
  CustomLoggerService,
  retryAsync,
} from 'nestjs-backend-common';

import {
  type FitharaClient,
  FitharaRequestError,
} from '../../shared';
import { RedisService } from '../redis';
import {
  FITHARA_CLIENT,
  MAX_REQUESTS_PER_USER_PER_HOUR,
} from './constants';
import { DraftLicenseInput } from './inputs';
import {
  CanonicalLicense,
  CanonicalLicenseSummary,
  LicenseAssistantTurn,
} from './types';
import {
  toFitharaDraft,
  toFitharaTurn,
  toGraphQLError,
  toLicenseAssistantDraft,
  toLicenseAssistantMessage,
} from './utils';

const ONE_HOUR_IN_SECONDS = 60 * 60;

@Injectable()
export class LicenseAssistantService {
  constructor(
    @Inject(FITHARA_CLIENT) private readonly fithara: FitharaClient,
    private readonly redis: RedisService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * @description Nothing is stored: Fithara is stateless too, so the client owns the conversation and the draft and sends them with every request. A forged history only shapes that user's own answer, and Fithara bounds its size.
   */
  async draft(
    userId: string,
    { conversation, draft, message, preferences }: DraftLicenseInput,
  ): Promise<LicenseAssistantTurn> {
    await this.assertWithinRateLimit(userId);

    const response = await this.call(() =>
      this.fithara.draft({
        message,
        preferences: preferences?.category
          ? { category: preferences.category }
          : null,
        conversation: conversation.map(toFitharaTurn),
        draft: draft ? toFitharaDraft(draft) : null,
      }),
    );

    return {
      assistantMessage: response.assistantMessage,
      draft: response.draft
        ? toLicenseAssistantDraft(response.draft)
        : null,
      draftChanged: response.draftChanged,
      recommendations: response.recommendations,
      disclaimers: response.disclaimers,
      isReadyToFinalize: response.isReadyToFinalize,
      conversation: response.conversation.map(
        toLicenseAssistantMessage,
      ),
    };
  }

  async listCanonicalLicenses(): Promise<CanonicalLicenseSummary[]> {
    const { licenses } = await this.call(() =>
      this.fithara.listLicenses(),
    );

    return licenses;
  }

  async getCanonicalLicense(id: string): Promise<CanonicalLicense> {
    return this.call(() => this.fithara.getLicense(id));
  }

  private async call<TResult>(
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    const [error, result] = await retryAsync(operation, { retry: 0 });

    if (!error) {
      return result as TResult;
    }
    if (!(error instanceof FitharaRequestError)) {
      throw error;
    }

    this.logger.warn(
      `Fithara call failed (${error.code ?? 'no code'}, request ${error.requestId ?? 'unknown'}): ${error.message}`,
    );

    throw toGraphQLError(error);
  }

  /**
   * @description Counted in Redis, in a window that starts at the user's first request. When Redis is down the limit is skipped, as Fithara has its own.
   */
  private async assertWithinRateLimit(userId: string): Promise<void> {
    const [error, requests] = await retryAsync(
      () =>
        this.redis.increment(
          `license-assistant:requests:${userId}`,
          ONE_HOUR_IN_SECONDS,
        ),
      { retry: 0 },
    );

    if (error) {
      this.logger.warn(
        `Could not count the license assistant requests of ${userId}: ${error.message}`,
      );
      return;
    }
    if ((requests as number) <= MAX_REQUESTS_PER_USER_PER_HOUR) {
      return;
    }

    throw new GraphQLError(
      'You sent too many messages to the license assistant. Try again later.',
      {
        extensions: {
          code: LICENSE_ASSISTANT_RATE_LIMITED,
          status: HttpStatus.TOO_MANY_REQUESTS,
        },
      },
    );
  }
}
