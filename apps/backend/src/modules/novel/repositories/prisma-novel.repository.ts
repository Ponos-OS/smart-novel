import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  Novel as PrismaNovel,
  TagStatus,
} from '@prisma/client';
import {
  CustomLoggerService,
  retryAsync,
} from 'nestjs-backend-common';

import { estimateRows, PrismaService } from '../../prisma';
import { writerIntegrityError } from '../../writer';
import {
  type CreateNovelData,
  type DeletedNovel,
  type FindNovelsPageArgs,
  type INovelRepository,
  type NovelWithPreviousCover,
  type UpdateNovelData,
} from '../interfaces';
import { Novel } from '../types';
import {
  buildAfterCursorCondition,
  buildFilterConditions,
  buildOrderBy,
} from './novel-page.sql';

/** @description Only reached when a caller skips the pagination bounds, which the service never does. */
const NOVELS_PAGE_SIZE_FALLBACK = 21;

const NOVEL_INCLUDE = {
  tags: { select: { tag: { select: { name: true } } } },
  writer: { select: { userId: true } },
} satisfies Prisma.NovelInclude;

@Injectable()
export class PrismaNovelRepository implements INovelRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * @description
   * Prisma cannot filter by a count and its cursor breaks on a nullable sort column (a row comparison with NULL is never true), so the page of ids is raw SQL with its own keyset, see {@link buildOrderBy}. The novels themselves are then loaded with their tags and put back in that order.
   */
  async findNovelsPage({
    page: { cursor, take, shouldReverse },
    filters,
    order,
  }: FindNovelsPageArgs): Promise<Novel[]> {
    const conditions = buildFilterConditions(filters);

    if (cursor) {
      conditions.push(
        await buildAfterCursorCondition(
          this.prisma,
          cursor.id,
          order,
          shouldReverse,
        ),
      );
    }

    const where = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      { id: string }[]
    >(Prisma.sql`
      SELECT n.id FROM novels n
      ${where}
      ${buildOrderBy(order, shouldReverse)}
      LIMIT ${take ?? NOVELS_PAGE_SIZE_FALLBACK}`);
    const ids = rows.map(({ id }) => id);
    const novels = await this.prisma.novel.findMany({
      where: { id: { in: ids } },
      include: NOVEL_INCLUDE,
    });
    const byId = new Map(novels.map((novel) => [novel.id, novel]));

    return ids.map((id) => this.toNovel(byId.get(id)!));
  }

  /**
   * @description
   * The planner's row estimate for the chapters of each novel, from `EXPLAIN` instead of `COUNT(*)`; see {@link estimateRows}. A novel whose estimate cannot be read gets 0.
   */
  async estimateChapterCounts(
    novelIds: string[],
  ): Promise<Map<string, number>> {
    const counts = await Promise.all(
      novelIds.map(async (novelId) => {
        const [error, count] = await retryAsync(
          () =>
            estimateRows(
              this.prisma,
              Prisma.sql`SELECT 1 FROM chapters WHERE novel_id = ${novelId}::uuid`,
            ),
          { retry: 0 },
        );

        if (error) {
          this.logger.warn(
            `Could not estimate the chapters of novel ${novelId}: ${error}`,
          );
        }

        return [novelId, error ? 0 : count] as const;
      }),
    );

    return new Map(counts);
  }

  async findById(id: string): Promise<Novel | null> {
    const novel = await this.prisma.novel.findUnique({
      where: { id },
      include: NOVEL_INCLUDE,
    });

    if (!novel) {
      return null;
    }

    return this.toNovel(novel);
  }

  async createNovel(data: CreateNovelData): Promise<Novel> {
    const { tags, ownerId, ...fields } = data;

    return this.prisma.$transaction(async (tx) => {
      const tagIds = await this.resolveTagIds(tx, tags ?? []);
      const writer = await tx.writer.findUnique({
        where: { userId: ownerId },
        select: { id: true },
      });

      if (!writer) {
        throw writerIntegrityError(
          this.logger,
          `user ${ownerId} creates a novel but has no writer row`,
        );
      }

      const novel = await tx.novel.create({
        data: {
          ...fields,
          writerId: writer.id,
          tags: {
            create: tagIds.map((tagId) => ({ tagId })),
          },
        },
        include: NOVEL_INCLUDE,
      });

      return this.toNovel(novel);
    });
  }

  async updateNovel(
    id: string,
    data: UpdateNovelData,
  ): Promise<Novel> {
    const { name, description, state, tags, licenseId } = data;

    return this.prisma.$transaction(async (tx) => {
      const tagIds = tags
        ? await this.resolveTagIds(tx, tags)
        : undefined;
      const novel = await tx.novel.update({
        where: { id },
        data: {
          name: name ?? undefined,
          description: description ?? undefined,
          state: state ?? undefined,
          licenseId: licenseId ?? undefined,
          tags: tagIds && {
            deleteMany: {},
            create: tagIds.map((tagId) => ({ tagId })),
          },
        },
        include: NOVEL_INCLUDE,
      });

      return this.toNovel(novel);
    });
  }

  async setCoverUrl(
    id: string,
    coverUrl: string,
  ): Promise<NovelWithPreviousCover> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.novel.findUniqueOrThrow({
        where: { id },
        select: { coverUrl: true },
      });
      const novel = await tx.novel.update({
        where: { id },
        data: { coverUrl },
        include: NOVEL_INCLUDE,
      });

      return {
        novel: this.toNovel(novel),
        previousCoverUrl: previous.coverUrl ?? undefined,
      };
    });
  }

  async deleteNovel(id: string): Promise<DeletedNovel | null> {
    return this.prisma.$transaction(async (tx) => {
      // Same lock `createChapter` takes, so a chapter being added cannot slip in mid-delete.
      await tx.$queryRaw`SELECT id FROM novels WHERE id = ${id}::uuid FOR UPDATE`;

      const novel = await tx.novel.findUnique({
        where: { id },
        select: {
          coverUrl: true,
          chapters: {
            select: { contentId: true, narrationUrl: true },
          },
        },
      });

      if (!novel) {
        return null;
      }

      // The novel delete cascades to chapters, read history and tag links, but the relation between a chapter and its content cascades the other way, so the content rows are removed explicitly.
      await tx.novel.delete({ where: { id } });
      await tx.chapterContent.deleteMany({
        where: {
          id: {
            in: novel.chapters.map((chapter) => chapter.contentId),
          },
        },
      });

      return {
        id,
        coverUrl: novel.coverUrl ?? undefined,
        narrationUrls: novel.chapters.flatMap((chapter) =>
          chapter.narrationUrl ? [chapter.narrationUrl] : [],
        ),
      };
    });
  }

  /**
   * @description Existing tags are matched case-insensitively (seed data has mixed casing); only the missing ones are created.
   */
  private async resolveTagIds(
    tx: Prisma.TransactionClient,
    names: string[],
  ): Promise<string[]> {
    if (names.length === 0) {
      return [];
    }

    const approved = await tx.tag.findMany({
      where: {
        name: { in: names, mode: 'insensitive' },
        status: TagStatus.APPROVED,
      },
      select: { id: true, name: true },
    });
    const approvedNames = new Set(
      approved.map((tag) => tag.name.toLowerCase()),
    );
    const unavailable = names.filter(
      (name) => !approvedNames.has(name),
    );

    if (unavailable.length > 0) {
      throw new BadRequestException(
        `These tags are not available: ${unavailable.join(', ')}. Request a new tag and add it once an admin approved it.`,
      );
    }

    return approved.map((tag) => tag.id);
  }

  private toNovel(
    record: PrismaNovel & {
      tags: { tag: { name: string } }[];
      writer: { userId: string };
    },
  ): Novel {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      state: record.state,
      ownerId: record.writer.userId,
      writerId: record.writerId,
      licenseId: record.licenseId,
      coverUrl: record.coverUrl ?? undefined,
      firstChapterCreatedAt:
        record.firstChapterCreatedAt ?? undefined,
      tags: record.tags.map((novelTag) =>
        novelTag.tag.name.toLowerCase(),
      ),
    };
  }
}
