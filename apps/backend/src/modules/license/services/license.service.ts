import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LicenseSourceType } from '@prisma/client';

import { CanonicalLicenseCatalog } from '../../fithara';
import { PrismaService } from '../../prisma';
import { SYSTEM_LICENSE_OWNER } from '../constants';
import { LicenseDraftInput } from '../inputs';
import { License } from '../types';
import {
  computeLicenseTextHash,
  normalizeLicenseText,
} from '../utils';

export interface NewLicense {
  name: string;
  text: string;
  textHash: string;
  ownerId: string;
  sourceType: LicenseSourceType;
  canonicalId: string | null;
}

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
      where: { isDefault: true, isDraft: false },
    });
  }

  /**
   * @description A shared license or one of the writer's; another writer's, a draft and an unknown id are all "not found".
   */
  async findUsable(id: string, ownerId: string): Promise<License> {
    const license = await this.prisma.license.findFirst({
      where: {
        id,
        isDraft: false,
        ownerId: {
          in: [...new Set([SYSTEM_LICENSE_OWNER, ownerId])],
        },
      },
    });

    if (!license) {
      throw new NotFoundException(`License with id ${id} not found`);
    }

    return license;
  }

  async findByIds(ids: string[]): Promise<Map<string, License>> {
    const licenses = await this.prisma.license.findMany({
      where: { id: { in: ids }, isDraft: false },
    });

    return new Map(licenses.map((license) => [license.id, license]));
  }

  /**
   * @description Reuses the stored row when the normalized text is already known (rows are immutable and deduplicated), so the existing row keeps its own name and source.
   * A text that is not stored yet cannot claim to be CANONICAL unless it is the registry's.
   */
  async getOrCreate(
    draft: LicenseDraftInput,
    ownerId: string,
  ): Promise<License> {
    const prepared = await this.prepareNew(draft, ownerId);

    if ('existing' in prepared) {
      return prepared.existing;
    }

    return this.insert(prepared.create);
  }

  /**
   * @description The checks every new license goes through, whether it comes from a novel's input or from finalizing a draft. A draft is never a match: its hash is null.
   */
  async prepareNew(
    draft: LicenseDraftInput,
    ownerId: string,
  ): Promise<{ existing: License } | { create: NewLicense }> {
    if (!draft.title.trim() || !draft.text.trim()) {
      throw new BadRequestException(
        'A license needs a name and a text',
      );
    }

    const textHash = computeLicenseTextHash(draft.text);
    const existing = await this.findByText(textHash, ownerId);

    if (existing) {
      return { existing };
    }

    const { type, canonicalId } = draft.source;

    if (type === LicenseSourceType.CANONICAL) {
      return {
        create: await this.verifyCanonical(draft, textHash),
      };
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

    return {
      create: {
        name: draft.title.trim(),
        text: normalizeLicenseText(draft.text),
        textHash,
        ownerId,
        sourceType: type,
        canonicalId: canonicalId ?? null,
      },
    };
  }

  /**
   * @description A text may only claim to be canonical when it is the one of Fithara's registry, word for word (whitespace aside), so a client cannot dress its own text as a well-known license. The row takes its name from the registry.
   */
  private async verifyCanonical(
    draft: LicenseDraftInput,
    textHash: string,
  ): Promise<NewLicense> {
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

    return {
      name: canonical.shortName,
      text: normalizeLicenseText(draft.text),
      textHash,
      ownerId: SYSTEM_LICENSE_OWNER,
      sourceType: LicenseSourceType.CANONICAL,
      canonicalId: canonical.id,
    };
  }

  private async insert(data: NewLicense): Promise<License> {
    // `upsert` is not atomic, two requests with the same new text would collide on `(owner_id, text_hash)`.
    await this.prisma.license.createMany({
      data: [data],
      skipDuplicates: true,
    });

    return this.prisma.license.findUniqueOrThrow({
      where: {
        ownerId_textHash: {
          ownerId: data.ownerId,
          textHash: data.textHash,
        },
      },
    });
  }

  /**
   * @description The shared (system) license with this text comes first, so an unmodified canonical text is always the canonical license; then the writer's own, so they never get a second copy of what they already have. Another writer's license is never a match.
   */
  private async findByText(
    textHash: string,
    ownerId: string,
  ): Promise<License | null> {
    for (const owner of new Set([SYSTEM_LICENSE_OWNER, ownerId])) {
      const found = await this.prisma.license.findUnique({
        where: { ownerId_textHash: { ownerId: owner, textHash } },
      });

      if (found) {
        return found;
      }
    }

    return null;
  }

  /**
   * @description A writer can use the shared licenses and their own, never another writer's. `ownerId` is the writer the license is for: the owner of the novel.
   * @returns `undefined` when nothing was selected, so the caller decides between the default and keeping the current license.
   */
  async resolve(
    { licenseId, licenseDraft }: LicenseSelection,
    ownerId: string,
  ): Promise<License | undefined> {
    if (licenseId && licenseDraft) {
      throw new BadRequestException(
        'Pass either licenseId or licenseDraft, not both',
      );
    }
    if (licenseId) {
      return this.findUsable(licenseId, ownerId);
    }
    if (licenseDraft) {
      return this.getOrCreate(licenseDraft, ownerId);
    }
  }

  /**
   * @description The default belongs to everybody, so it is always a shared license: an admin picks one that is, or writes a text that becomes one.
   */
  async setDefault(selection: LicenseSelection): Promise<License> {
    const license = await this.resolve(
      selection,
      SYSTEM_LICENSE_OWNER,
    );

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
