import type { TadaDocumentNode } from 'gql.tada';

import axios from 'axios';
import { print } from 'graphql';

export interface BeatriceGraphQLError {
  message: string;
  path?: readonly (string | number)[];
  extensions?: Record<string, unknown>;
}

/**
 * @description Raised when Beatrice returns a 2xx response whose `errors` array is non-empty. Keeps every error object so callers can pattern-match on `extensions.code` etc.
 */
export class BeatriceRequestError extends Error {
  constructor(
    message: string,
    public readonly errors: readonly BeatriceGraphQLError[],
  ) {
    super(message);
    this.name = BeatriceRequestError.name;
  }
}

interface BeatriceEnvelope<TResult> {
  data?: TResult;
  errors?: BeatriceGraphQLError[];
}

export interface RunOperationOptions {
  /** Beatrice's GraphQL endpoint URL. */
  url: string;
  /** Hard deadline in milliseconds. */
  timeoutMs: number;
  /**
   * Raw `Authorization` header value (e.g. `Bearer <token>`) to forward to Beatrice.
   */
  authorization?: string;
}

/**
 * Execute a `gql.tada`-typed operation against Beatrice.
 */
export async function runOperation<TResult, TVariables>(
  document: TadaDocumentNode<TResult, TVariables>,
  variables: TVariables,
  { url, timeoutMs, authorization }: RunOperationOptions,
): Promise<TResult> {
  const { data: envelope } = await axios.post<
    BeatriceEnvelope<TResult>
  >(
    url,
    {
      query: print(document),
      variables,
    },
    {
      timeout: timeoutMs,
      headers: {
        'content-type': 'application/json',
        accept: 'application/graphql-response+json, application/json',
        ...(authorization ? { authorization } : {}),
      },
    },
  );

  if (envelope.errors && envelope.errors.length > 0) {
    throw new BeatriceRequestError(
      envelope.errors.map((entry) => entry.message).join('; '),
      envelope.errors,
    );
  }

  if (!envelope.data) {
    throw new BeatriceRequestError(
      'Beatrice response contained neither data nor errors',
      [],
    );
  }

  return envelope.data;
}
