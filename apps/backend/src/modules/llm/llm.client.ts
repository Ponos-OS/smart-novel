import type { ConfigType } from '@nestjs/config';

import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { graphql, type TadaDocumentNode } from 'gql.tada';
import ms from 'ms';
import { CustomLoggerService } from 'nestjs-backend-common';

import { appConfigs } from '../../app/configs/app.config';
import { runOperation } from '../../shared';

const EXPLAIN_WORD_MUTATION = graphql(`
  mutation ExplainWord($word: String!, $context: String!) {
    explainWord(word: $word, context: $context) {
      meaning
      simplifiedExplanation
      synonyms
      antonyms
    }
  }
`);
const NORMALIZE_TEXT_FOR_TTS_MUTATION = graphql(`
  mutation NormalizeTextForTts($text: String!) {
    normalizeTextForTts(text: $text)
  }
`);
const GENERATE_AUDIO_MUTATION = graphql(`
  mutation GenerateAudio(
    $text: String!
    $voice: String!
    $genUploadUrl: String!
    $statusCallbackUrl: String!
    $clientContextId: String
  ) {
    generateAudio(
      text: $text
      voice: $voice
      genUploadUrl: $genUploadUrl
      statusCallbackUrl: $statusCallbackUrl
      clientContextId: $clientContextId
    ) {
      jobId
    }
  }
`);

/**
 * @description Thin, typed wrapper around Beatrice's GraphQL API.
 */
@Injectable()
export class LlmClient {
  constructor(
    @Inject(appConfigs.KEY)
    private readonly appConfig: ConfigType<typeof appConfigs>,
    private readonly logger: CustomLoggerService,
  ) {}

  explainWord(word: string, context: string) {
    return this.run(EXPLAIN_WORD_MUTATION, { word, context });
  }

  normalizeTextForTts(text: string) {
    return this.run(NORMALIZE_TEXT_FOR_TTS_MUTATION, { text });
  }

  /**
   * @description `authorization` is forwarded to Beatrice's `/graphql` request so it can
   * relay it on its `genUploadUrl`/`statusCallbackUrl` callbacks — those are guarded on
   * our end and need a bearer token to pass.
   */
  generateAudio(
    text: string,
    voice: string,
    genUploadUrl: string,
    statusCallbackUrl: string,
    clientContextId: string,
    authorization: string,
  ) {
    return this.run(
      GENERATE_AUDIO_MUTATION,
      {
        text,
        voice,
        genUploadUrl,
        statusCallbackUrl,
        clientContextId,
      },
      authorization,
    );
  }

  private async run<TResult, TVariables>(
    document: TadaDocumentNode<TResult, TVariables>,
    variables: TVariables,
    authorization?: string,
  ): Promise<TResult> {
    return await runOperation(document, variables, {
      url: this.appConfig.BEATRICE_URL,
      timeoutMs: ms(this.appConfig.BEATRICE_TIMEOUT),
      authorization,
    }).catch((error) => {
      this.logger.error('Beatrice GraphQL call failed', {
        context: LlmClient.name,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new InternalServerErrorException();
    });
  }
}
