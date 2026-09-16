import { CustomLoggerService } from 'nestjs-backend-common';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * @description Shared by `NovelPolicy` and `ChapterPolicy` — a chapter's ownership is always
 * resolved through its parent novel's owner.
 */
export async function isNovelOwner(
  prisma: PrismaService,
  logger: CustomLoggerService,
  userId: string,
  novelId: string,
): Promise<boolean> {
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    select: { ownerId: true },
  });

  if (!novel) {
    logger.warn(`Novel not found: ${novelId}`);
    return false;
  }

  return novel.ownerId === userId;
}
