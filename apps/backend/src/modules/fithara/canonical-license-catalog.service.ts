import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CustomLoggerService,
  retryAsync,
} from 'nestjs-backend-common';

import {
  type FitharaClient,
  FitharaRequestError,
} from '../../shared';
import { FITHARA_CLIENT } from './constants';

const OFFICIAL_URLS_TTL_MS = 60 * 60 * 1000;

export interface VerbatimCanonicalLicense {
  id: string;
  shortName: string;
  body: string;
}

/**
 * @description What the rest of the backend needs from Fithara's registry of canonical licenses, apart from the assistant itself.
 */
@Injectable()
export class CanonicalLicenseCatalog {
  private officialUrls: {
    expiresAt: number;
    byId: Promise<Map<string, string>>;
  } | null = null;

  constructor(
    @Inject(FITHARA_CLIENT) private readonly fithara: FitharaClient,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * @returns `null` when Fithara does not know the license, or no longer offers it.
   * @throws ServiceUnavailableException when Fithara cannot be asked: a text must not be taken as canonical on a guess.
   */
  async findVerbatim(
    canonicalId: string,
  ): Promise<VerbatimCanonicalLicense | null> {
    const [error, license] = await retryAsync(
      () => this.fithara.getLicense(canonicalId),
      { retry: 0 },
    );

    if (!error) {
      return license as VerbatimCanonicalLicense;
    }
    if (
      error instanceof FitharaRequestError &&
      (error.code === 'UNKNOWN_LICENSE' ||
        error.code === 'LICENSE_INACTIVE')
    ) {
      return null;
    }

    this.logger.warn(
      `Could not read the canonical license ${canonicalId} from Fithara: ${error.message}`,
    );

    throw new ServiceUnavailableException(
      'The canonical license registry is not available right now. Try again later.',
    );
  }

  /**
   * @description Only a link on a page, so a registry that cannot be reached gives `null` instead of failing the query.
   */
  async getOfficialUrl(canonicalId: string): Promise<string | null> {
    const [error, byId] = await retryAsync(
      () => this.loadOfficialUrls(),
      { retry: 0 },
    );

    if (error) {
      this.logger.warn(
        `Could not list the canonical licenses of Fithara: ${error.message}`,
      );
      this.officialUrls = null;
      return null;
    }

    return byId?.get(canonicalId) ?? null;
  }

  private loadOfficialUrls(): Promise<Map<string, string>> {
    if (
      this.officialUrls &&
      this.officialUrls.expiresAt > Date.now()
    ) {
      return this.officialUrls.byId;
    }

    const byId = this.fithara
      .listLicenses()
      .then(
        ({ licenses }) =>
          new Map(
            licenses.map((license) => [
              license.id,
              license.officialUrl,
            ]),
          ),
      );

    this.officialUrls = {
      expiresAt: Date.now() + OFFICIAL_URLS_TTL_MS,
      byId,
    };

    return byId;
  }
}
