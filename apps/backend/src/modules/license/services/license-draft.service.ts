import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LicenseSourceType, Prisma } from '@prisma/client';
import { LICENSE_DRAFTS_PER_WRITER_MAX } from '@smart-novel/shared';
import { PageInfo } from 'nestjs-backend-common';

import {
  buildCursorPaginationParams,
  type PaginationArgs,
  trimCursorPaginationResults,
} from '../../../shared';
import { CanonicalLicenseCatalog } from '../../fithara';
import { PrismaService } from '../../prisma';
import {
  CreateLicenseDraftInput,
  LicenseDraftFiltersInput,
  SaveLicenseDraftInput,
} from '../inputs';
import {
  License,
  LicenseDraft,
  LicenseDraftConnection,
  LicenseDraftEdge,
} from '../types';
import { LicenseService } from './license.service';

type DraftRow = Prisma.LicenseGetPayload<object>;

/** @description Who is asking; an admin may read every writer's drafts, but write only their own. */
export interface DraftViewer {
  id: string;
  isAdmin: boolean;
}

/**
 * @description A draft is a row of `licenses` flagged `isDraft` and owned by its writer. It is mutable, has no hash and is invisible to every other path; every statement here names the owner, and writes also name `isDraft`, so a draft that was finalized a moment ago can never be changed through a late save.
 */
@Injectable()
export class LicenseDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseService: LicenseService,
    private readonly canonicalLicenseCatalog: CanonicalLicenseCatalog,
  ) {}

  async create(
    ownerId: string,
    { licenseId, canonicalId }: CreateLicenseDraftInput,
  ): Promise<LicenseDraft> {
    if (licenseId && canonicalId) {
      throw new BadRequestException(
        'Pass either licenseId or canonicalId, not both',
      );
    }

    const drafts = await this.prisma.license.count({
      where: { ownerId, isDraft: true },
    });

    if (drafts >= LICENSE_DRAFTS_PER_WRITER_MAX) {
      throw new BadRequestException(
        `You have ${LICENSE_DRAFTS_PER_WRITER_MAX} unfinished license drafts. Finish or discard one first.`,
      );
    }

    const base = await this.findBase(ownerId, {
      licenseId,
      canonicalId,
    });
    const draft = await this.prisma.license.create({
      data: { ...base, ownerId, isDraft: true },
    });

    return this.toDraft(draft);
  }

  async save(
    ownerId: string,
    { id, title, text, source }: SaveLicenseDraftInput,
  ): Promise<LicenseDraft> {
    const current = await this.findOwned(ownerId, id);
    const canonicalId = source.canonicalId ?? null;

    if (
      current.name === title &&
      current.text === text &&
      current.sourceType === source.type &&
      current.canonicalId === canonicalId
    ) {
      return this.toDraft(current);
    }

    const { count } = await this.prisma.license.updateMany({
      where: { id, ownerId, isDraft: true },
      data: {
        name: title,
        text,
        sourceType: source.type,
        canonicalId,
      },
    });

    if (count === 0) {
      throw this.notFound(id);
    }

    return this.toDraft(await this.findOwned(ownerId, id));
  }

  async findOne(
    viewer: DraftViewer,
    id: string,
  ): Promise<LicenseDraft> {
    const draft = await this.prisma.license.findFirst({
      where: {
        id,
        isDraft: true,
        ...(viewer.isAdmin ? {} : { ownerId: viewer.id }),
      },
    });

    if (!draft) {
      throw this.notFound(id);
    }

    return this.toDraft(draft);
  }

  /**
   * @description A writer lists their own drafts (naming anybody else is refused); an admin lists everybody's, or the writers they name.
   */
  async findConnection(
    viewer: DraftViewer,
    pagination: PaginationArgs,
    filters?: LicenseDraftFiltersInput,
  ): Promise<LicenseDraftConnection> {
    const ownerIds = filters?.ownerIds?.length
      ? filters.ownerIds
      : undefined;

    if (!viewer.isAdmin && ownerIds?.some((id) => id !== viewer.id)) {
      throw new ForbiddenException(
        'Writers can list only their own license drafts',
      );
    }

    const owners = viewer.isAdmin ? ownerIds : [viewer.id];
    const { cursor, skip, take, shouldReverse } =
      buildCursorPaginationParams(pagination);
    const direction = shouldReverse ? 'asc' : 'desc';
    const rows = await this.prisma.license.findMany({
      where: {
        isDraft: true,
        ...(owners ? { ownerId: { in: owners } } : {}),
      },
      orderBy: [{ updatedAt: direction }, { id: direction }],
      cursor,
      skip,
      take,
    });
    const { items, hasMore } = trimCursorPaginationResults(
      rows,
      pagination,
      shouldReverse,
    );
    const edges: LicenseDraftEdge[] = items.map((row) => ({
      cursor: Buffer.from(row.id).toString('base64'),
      node: this.toDraft(row),
    }));
    const pageInfo: PageInfo = {
      startCursor: edges.length > 0 ? edges[0].cursor : null,
      endCursor:
        edges.length > 0 ? edges[edges.length - 1].cursor : null,
      hasPreviousPage: !!pagination.after,
      hasNextPage: hasMore && !!pagination.first,
    };
    const connection = new LicenseDraftConnection();

    connection.edges = edges;
    connection.pageInfo = pageInfo;

    return connection;
  }

  async discard(ownerId: string, id: string): Promise<void> {
    const { count } = await this.prisma.license.deleteMany({
      where: { id, ownerId, isDraft: true },
    });

    if (count === 0) {
      throw this.notFound(id);
    }
  }

  /**
   * @returns The license to use. It is the draft itself, promoted, unless a real license with the same text exists: then that one is returned and the draft is deleted, so its id can differ from the draft's.
   */
  async finalize(ownerId: string, id: string): Promise<License> {
    const draft = await this.findOwned(ownerId, id);
    const prepared = await this.licenseService.prepareNew(
      {
        title: draft.name,
        text: draft.text,
        source: {
          type: draft.sourceType,
          canonicalId: draft.canonicalId ?? undefined,
        },
      },
      ownerId,
    );

    if ('existing' in prepared) {
      await this.discard(ownerId, id);

      return prepared.existing;
    }

    try {
      const { count } = await this.prisma.license.updateMany({
        where: { id, ownerId, isDraft: true },
        data: { ...prepared.create, isDraft: false },
      });

      if (count === 0) {
        throw this.notFound(id);
      }
    } catch (error) {
      if (!this.isTextHashTaken(error)) {
        throw error;
      }

      // The same text was stored between the check and the promotion.
      const existing = await this.prisma.license.findUniqueOrThrow({
        where: {
          ownerId_textHash: {
            ownerId: prepared.create.ownerId,
            textHash: prepared.create.textHash,
          },
        },
      });
      await this.discard(ownerId, id);

      return existing;
    }

    return this.prisma.license.findUniqueOrThrow({ where: { id } });
  }

  private async findBase(
    ownerId: string,
    { licenseId, canonicalId }: CreateLicenseDraftInput,
  ) {
    if (licenseId) {
      const license = await this.licenseService.findUsable(
        licenseId,
        ownerId,
      );

      return {
        name: license.name,
        text: license.text,
        sourceType: license.sourceType,
        canonicalId: license.canonicalId,
      };
    }
    if (canonicalId) {
      const canonical =
        await this.canonicalLicenseCatalog.findVerbatim(canonicalId);

      if (!canonical) {
        throw new BadRequestException(
          `${canonicalId} is not a known canonical license`,
        );
      }

      return {
        name: canonical.shortName,
        text: canonical.body,
        sourceType: LicenseSourceType.CANONICAL,
        canonicalId: canonical.id,
      };
    }

    return {
      name: '',
      text: '',
      sourceType: LicenseSourceType.CUSTOM,
      canonicalId: null,
    };
  }

  private async findOwned(
    ownerId: string,
    id: string,
  ): Promise<DraftRow> {
    const draft = await this.prisma.license.findFirst({
      where: { id, ownerId, isDraft: true },
    });

    if (!draft) {
      throw this.notFound(id);
    }

    return draft;
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException(`License draft ${id} not found`);
  }

  private isTextHashTaken(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private toDraft(draft: DraftRow): LicenseDraft {
    return {
      id: draft.id,
      ownerId: draft.ownerId,
      title: draft.name,
      text: draft.text,
      source: {
        type: draft.sourceType,
        canonicalId: draft.canonicalId,
      },
      updatedAt: draft.updatedAt.toISOString(),
    };
  }
}
