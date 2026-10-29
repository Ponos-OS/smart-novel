import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LicenseSourceType } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

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
      throw new BadRequestException(
        'This text is not a known canonical license, send it as FORKED or CUSTOM',
      );
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

    // `upsert` is not atomic, two requests with the same new text would collide on `text_hash`.
    await this.prisma.license.createMany({
      data: [
        {
          name: draft.title,
          text: normalizeLicenseText(draft.text),
          textHash,
          sourceType: type,
          canonicalId: canonicalId ?? null,
        },
      ],
      skipDuplicates: true,
    });

    return this.prisma.license.findUniqueOrThrow({
      where: { textHash },
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
