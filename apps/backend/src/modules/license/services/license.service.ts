import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LicenseSourceType } from '@prisma/client';

import { CanonicalLicenseCatalog } from '../../fithara';
import { PrismaService } from '../../prisma';
import { LicenseDraftInput } from '../inputs';
import { License } from '../types';
import {
  computeLicenseTextHash,
  normalizeLicenseText,
} from '../utils';

export interface LicenseSelection {
  licenseId?: string;
  licenseDraft?: LicenseDraftInput;
}

@Injectable()
export class LicenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly canonicalLicenseCatalog: CanonicalLicenseCatalog,
  ) {}

  async getDefault(): Promise<License> {
    return this.prisma.license.findFirstOrThrow({
      where: { isDefault: true },
    });
  }

  async findOne(id: string): Promise<License> {
    const license = await this.prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      throw new NotFoundException(`License with id ${id} not found`);
    }

    return license;
  }

  async findByIds(ids: string[]): Promise<Map<string, License>> {
    const licenses = await this.prisma.license.findMany({
      where: { id: { in: ids } },
    });

    return new Map(licenses.map((license) => [license.id, license]));
  }

  /**
   * @description Reuses the stored row when the normalized text is already known (rows are immutable and deduplicated), so the existing row keeps its own name and source.
   * A text that is not stored yet cannot claim to be CANONICAL: only seeded canonical texts are trusted.
   */
  async getOrCreate(draft: LicenseDraftInput): Promise<License> {
    const textHash = computeLicenseTextHash(draft.text);
    const existing = await this.prisma.license.findUnique({
      where: { textHash },
    });

    if (existing) {
      return existing;
    }

    const { type, canonicalId } = draft.source;

    if (type === LicenseSourceType.CANONICAL) {
      return this.createVerifiedCanonical(draft, textHash);
    }
    if (type === LicenseSourceType.FORKED && !canonicalId) {
      throw new BadRequestException(
        'A FORKED license needs the canonicalId it was modified from',
      );
    }
    if (type === LicenseSourceType.CUSTOM && canonicalId) {
      throw new BadRequestException(
        'A CUSTOM license has no canonicalId',
      );
    }

    return this.insert({
      name: draft.title,
      text: draft.text,
      textHash,
      sourceType: type,
      canonicalId: canonicalId ?? null,
    });
  }

  /**
   * @description A text may only claim to be canonical when it is the one of Fithara's registry, word for word (whitespace aside), so a client cannot dress its own text as a well-known license. The row takes its name from the registry.
   */
  private async createVerifiedCanonical(
    draft: LicenseDraftInput,
    textHash: string,
  ): Promise<License> {
    const { canonicalId } = draft.source;

    if (!canonicalId) {
      throw new BadRequestException(
        'A CANONICAL license needs its canonicalId',
      );
    }

    const canonical =
      await this.canonicalLicenseCatalog.findVerbatim(canonicalId);

    if (
      !canonical ||
      computeLicenseTextHash(canonical.body) !== textHash
    ) {
      throw new BadRequestException(
        `This text is not the canonical license ${canonicalId}, send it as FORKED or CUSTOM`,
      );
    }

    return this.insert({
      name: canonical.shortName,
      text: draft.text,
      textHash,
      sourceType: LicenseSourceType.CANONICAL,
      canonicalId: canonical.id,
    });
  }

  private async insert(data: {
    name: string;
    text: string;
    textHash: string;
    sourceType: LicenseSourceType;
    canonicalId: string | null;
  }): Promise<License> {
    // `upsert` is not atomic, two requests with the same new text would collide on `text_hash`.
    await this.prisma.license.createMany({
      data: [{ ...data, text: normalizeLicenseText(data.text) }],
      skipDuplicates: true,
    });

    return this.prisma.license.findUniqueOrThrow({
      where: { textHash: data.textHash },
    });
  }

  /**
   * @returns `undefined` when nothing was selected, so the caller decides between the default and keeping the current license.
   */
  async resolve({
    licenseId,
    licenseDraft,
  }: LicenseSelection): Promise<License | undefined> {
    if (licenseId && licenseDraft) {
      throw new BadRequestException(
        'Pass either licenseId or licenseDraft, not both',
      );
    }
    if (licenseId) {
      return this.findOne(licenseId);
    }
    if (licenseDraft) {
      return this.getOrCreate(licenseDraft);
    }
  }

  async setDefault(selection: LicenseSelection): Promise<License> {
    const license = await this.resolve(selection);

    if (!license) {
      throw new BadRequestException(
        'Pass either licenseId or licenseDraft',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // The database cannot hold a partial unique index on `is_default` (see `schema.prisma`), so concurrent switches are serialized here.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('licenses.is_default'))`;
      await tx.license.updateMany({
        where: { isDefault: true, id: { not: license.id } },
        data: { isDefault: false },
      });

      return tx.license.update({
        where: { id: license.id },
        data: { isDefault: true },
      });
    });
  }
}
