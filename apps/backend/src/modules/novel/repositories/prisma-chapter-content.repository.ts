import { Injectable } from '@nestjs/common';
import { ChapterContent as PrismaChapterContent } from '@prisma/client';
import { isNil } from 'nestjs-backend-common';

import { PrismaService, PrismaTransactionClient } from '../../prisma';
import {
  IChapterContent,
  IChapterContentRepository,
} from '../interfaces';
import { computeContentHash } from '../utils';

@Injectable()
export class PrismaChapterContentRepository implements IChapterContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIds(
    ids: string[],
  ): Promise<Map<string, IChapterContent>> {
    const records = await this.prisma.chapterContent.findMany({
      where: { id: { in: ids } },
    });

    const map = new Map<string, IChapterContent>();

    for (const record of records) {
      map.set(record.id, this.toChapterContent(record));
    }

    return map;
  }

  async findByChapterId(chapterId: string): Promise<IChapterContent> {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { content: true },
    });

    if (isNil(chapter?.content)) {
      throw new Error('Chapter content not found');
    }

    return this.toChapterContent(chapter.content);
  }

  async upsertByChapterId(
    chapterId: string,
    content: string,
    tx?: PrismaTransactionClient,
  ): Promise<IChapterContent> {
    const client = tx ?? this.prisma;
    const contentHash = computeContentHash(content);

    const { contentId } = await client.chapter.findUniqueOrThrow({
      where: { id: chapterId },
      select: { contentId: true },
    });
    // Written on its own so `Chapter.updatedAt` (the metadata version token) stays put.
    const record = await client.chapterContent.update({
      where: { id: contentId },
      data: { content, contentHash },
    });

    return this.toChapterContent(record);
  }

  private toChapterContent(
    record: PrismaChapterContent,
  ): IChapterContent {
    return {
      id: record.id,
      content: record.content,
      contentHash: record.contentHash,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
