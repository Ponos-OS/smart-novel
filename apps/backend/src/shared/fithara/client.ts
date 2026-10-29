import createClient from 'openapi-fetch';

import type { components, paths } from './schema';

export type FitharaDraftRequest =
  components['schemas']['DraftRequest'];
export type FitharaDraftResponse =
  components['schemas']['DraftResponse'];
export type FitharaDraft = components['schemas']['Draft'];
export type FitharaConversationTurn =
  components['schemas']['ConversationTurn'];
export type FitharaLicenseSummary =
  components['schemas']['LicenseSummary'];
export type FitharaLicenseDetail =
  components['schemas']['LicenseDetail'];
export type FitharaErrorCode =
  components['schemas']['ErrorDetail']['code'];

/**
 * @description Raised for any failed call to Fithara. `status` and `code` are absent when Fithara could not be reached at all.
 */
export class FitharaRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: FitharaErrorCode,
    public readonly requestId?: string | null,
  ) {
    super(message);
    this.name = FitharaRequestError.name;
  }
}

export interface FitharaClientOptions {
  baseUrl: string;
  timeoutMs: number;
}

interface FitharaResult<TData> {
  data?: TData;
  error?: unknown;
  response: Response;
}

function toRequestError(
  error: unknown,
  status: number,
): FitharaRequestError {
  const detail = (
    error as { error?: components['schemas']['ErrorDetail'] }
  )?.error;

  if (detail) {
    return new FitharaRequestError(
      detail.message,
      status,
      detail.code,
      detail.requestId,
    );
  }

  return new FitharaRequestError(
    `Fithara answered ${status}`,
    status,
    status === 422 ? 'INVALID_REQUEST' : undefined,
  );
}

export function createFitharaClient({
  baseUrl,
  timeoutMs,
}: FitharaClientOptions) {
  const client = createClient<paths>({ baseUrl });

  async function unwrap<TData>(
    call: (signal: AbortSignal) => Promise<FitharaResult<TData>>,
  ): Promise<TData> {
    const result = await call(AbortSignal.timeout(timeoutMs)).catch(
      (error: Error) => {
        throw new FitharaRequestError(
          `Could not reach Fithara: ${error.message}`,
        );
      },
    );

    if (result.data === undefined) {
      throw toRequestError(result.error, result.response.status);
    }

    return result.data;
  }

  return {
    listLicenses: () =>
      unwrap((signal) => client.GET('/v1/licenses', { signal })),
    getLicense: (licenseId: string) =>
      unwrap((signal) =>
        client.GET('/v1/licenses/{license_id}', {
          params: { path: { license_id: licenseId } },
          signal,
        }),
      ),
    draft: (body: FitharaDraftRequest) =>
      unwrap((signal) => client.POST('/v1/draft', { body, signal })),
  };
}

export type FitharaClient = ReturnType<typeof createFitharaClient>;
