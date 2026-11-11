import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TagStatus } from '@prisma/client';
import {
  CustomLoggerService,
  retryAsync,
} from 'nestjs-backend-common';

import {
  boundPagination,
  buildAudience,
  escapeLikePattern,
  paginateConnection,
  PaginationArgs,
} from '../../../shared';
import { CursorCodec } from '../../cursor';
import { estimateRows, PrismaService } from '../../prisma';
import {
  TAGS_PAGE_SIZE_DEFAULT,
  TAGS_PAGE_SIZE_MAX,
} from '../constants';
import {
  CreateTagInput,
  RequestTagInput,
  TagFiltersInput,
  UpdateTagInput,
} from '../inputs';
import { DeleteTagResponse, Tag, TagConnection } from '../types';

const TAG_SELECT = {
  id: true,
  name: true,
  description: true,
  status: true,
  requesterUserId: true,
} satisfies Prisma.TagSelect;

/**
 * @description
 * A name matches when it, or one of its words, starts with the text: `life` finds `slice of life` and `sci` finds `hard sci-fi`, but `ntas` does not find `fantasy`. Words are split by a space or a hyphen.
 */
function wordStartMatches(
  escapedText: string,
): Prisma.TagWhereInput[] {
  return [
    { name: { startsWith: escapedText, mode: 'insensitive' } },
    { name: { contains: ` ${escapedText}`, mode: 'insensitive' } },
    { name: { contains: `-${escapedText}`, mode: 'insensitive' } },
  ];
}

@Injectable()
export class TagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: CustomLoggerService,
    private readonly cursorCodec: CursorCodec,
  ) {}

  async findConnection(
    isAdmin: boolean,
    pagination: PaginationArgs,
    filters?: TagFiltersInput,
  ): Promise<TagConnection> {
    const page = boundPagination(pagination, {
      defaultSize: TAGS_PAGE_SIZE_DEFAULT,
      maxSize: TAGS_PAGE_SIZE_MAX,
    });
    const statuses =
      isAdmin && filters?.statuses?.length
        ? filters.statuses
        : [TagStatus.APPROVED];
    const where: Prisma.TagWhereInput = {
      status: { in: statuses },
      ...(filters?.search && {
        OR: wordStartMatches(escapeLikePattern(filters.search)),
      }),
    };
    const { edges, pageInfo } = await paginateConnection({
      codec: this.cursorCodec,
      audience: buildAudience('tags', { where }),
      pagination: page,
      findMany: ({ cursor, skip, take, shouldReverse }) =>
        this.prisma.tag.findMany({
          where,
          orderBy: { name: shouldReverse ? 'desc' : 'asc' },
          select: TAG_SELECT,
          cursor,
          skip,
          take,
        }),
      toNode: (row) => row,
    });

    return Object.assign(new TagConnection(), {
      edges,
      pageInfo,
    });
  }

  async request(
    requesterUserId: string,
    input: RequestTagInput,
  ): Promise<Tag> {
    return this.insert(input, {
      status: TagStatus.PENDING,
      requesterUserId,
    });
  }

  async create(input: CreateTagInput): Promise<Tag> {
    return this.insert(input, { status: TagStatus.APPROVED });
  }

  private async insert(
    { name, description }: RequestTagInput,
    origin: { status: TagStatus; requesterUserId?: string },
  ): Promise<Tag> {
    // `skipDuplicates` (ON CONFLICT DO NOTHING) keeps two concurrent requests for one name from failing on the unique index.
    const { count } = await this.prisma.tag.createMany({
      data: [{ name, description, ...origin }],
      skipDuplicates: true,
    });

    if (count === 0) {
      throw this.toAlreadyExists(name);
    }

    return this.prisma.tag.findUniqueOrThrow({
      where: { name },
      select: TAG_SELECT,
    });
  }

  async approve(id: string): Promise<Tag> {
    await this.prisma.tag.updateMany({
      where: { id, status: TagStatus.PENDING },
      data: { status: TagStatus.APPROVED },
    });

    const tag = await this.prisma.tag.findUnique({
      where: { id },
      select: TAG_SELECT,
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  async update(id: string, changes: UpdateTagInput): Promise<Tag> {
    const { name, description } = changes;

    if (name === undefined && description === undefined) {
      throw new BadRequestException(
        'Provide a name, a description or both',
      );
    }

    const [error, tag] = await retryAsync(
      () =>
        this.prisma.tag.update({
          where: { id },
          data: { name, description },
          select: TAG_SELECT,
        }),
      { retry: 0 },
    );

    if (error) {
      throw this.toKnownError(error, name);
    }

    return tag;
  }

  async delete(id: string): Promise<DeleteTagResponse> {
    const [error] = await retryAsync(
      () => this.prisma.tag.delete({ where: { id } }),
      { retry: 0 },
    );

    if (error) {
      throw this.toKnownError(error);
    }

    return { id };
  }

  /**
   * @description
   * The planner's row estimate for the novels of each tag, from `EXPLAIN` instead of `COUNT(*)`. `EXPLAIN` only plans the query, so its cost stays flat (about 0.2 ms) however many novels a tag has, while `COUNT(*)` has to visit every matching row and grows with the tag: orders of magnitude slower once tags hold hundreds of thousands of novels or more. The price is accuracy: the estimate is only as fresh as the table statistics (`ANALYZE`), and the planner never goes below 1. A tag whose estimate cannot be read gets 0.
   */
  async estimateNovelCounts(
    tagIds: string[],
  ): Promise<Map<string, number>> {
    const counts = await Promise.all(
      tagIds.map(async (tagId) => {
        const [error, count] = await retryAsync(
          () => this.explainNovelCount(tagId),
          { retry: 0 },
        );

        if (error) {
          this.logger.warn(
            `Could not estimate the novels of tag ${tagId}: ${error}`,
          );
        }

        return [tagId, error ? 0 : count] as const;
      }),
    );

    return new Map(counts);
  }

  private async explainNovelCount(tagId: string): Promise<number> {
    return estimateRows(
      this.prisma,
      Prisma.sql`SELECT 1 FROM novel_tags WHERE tag_id = ${tagId}::uuid`,
    );
  }

  private toKnownError(error: unknown, name?: string): unknown {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return error;
    }

    if (error.code === 'P2025') {
      return new NotFoundException('Tag not found');
    }

    if (error.code === 'P2002' && name) {
      return this.toAlreadyExists(name);
    }

    return error;
  }

  private toAlreadyExists(
    normalizedName: string,
  ): BadRequestException {
    return new BadRequestException(
      `The tag "${normalizedName}" already exists or was already requested. Search for "${normalizedName}" instead.`,
    );
  }
}
