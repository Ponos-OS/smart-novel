import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma';
import {
  IChapterUserState,
  IChapterUserStateRepository,
} from '../interfaces';

@Injectable()
export class PrismaChapterUserStateRepository implements IChapterUserStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async markChaptersRead(
    userId: string,
    chapterData: Array<{ chapterId: string; novelId: string }>,
  ): Promise<number> {
    const data = chapterData.map((ch) => ({
      userId,
      chapterId: ch.chapterId,
      novelId: ch.novelId,
    }));
    const result = await this.prisma.chapterUserState.createMany({
      data,
      skipDuplicates: true,
    });

    return result.count;
  }

  async findReadChapterIds(
    userId: string,
    novelId: string,
  ): Promise<string[]> {
    const records = await this.prisma.chapterUserState.findMany({
      where: {
        userId,
        novelId,
      },
      select: {
        chapterId: true,
      },
    });

    return records.map((record) => record.chapterId);
  }

  async batchLoadByChapterIds(
    userId: string,
    chapterIds: string[],
  ): Promise<Map<string, IChapterUserState>> {
    const records = await this.prisma.chapterUserState.findMany({
      where: {
        userId,
        chapterId: {
          in: chapterIds,
        },
      },
    });

    const map = new Map<string, IChapterUserState>();

    for (const record of records) {
      map.set(record.chapterId, this.toChapterUserState(record));
    }

    return map;
  }

  async deleteAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.chapterUserState.deleteMany({
      where: {
        userId,
      },
    });

    return result.count;
  }

  private toChapterUserState(record: any): IChapterUserState {
    return {
      userId: record.userId,
      novelId: record.novelId,
      chapterId: record.chapterId,
      firstReadAt: record.firstReadAt.toISOString(),
    };
  }
}
