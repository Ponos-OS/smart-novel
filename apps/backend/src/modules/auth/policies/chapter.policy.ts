import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from 'nestjs-backend-common';

import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../enums';
import { hasMinimumRole, isAdmin } from '../utils';
import { isNovelOwner } from './novel-ownership.util';
import {
  IResourcePolicy,
  ResourcePolicyCheckParams,
} from './resource-policy.interface';

/**
 * @description
 * Permission model for `chapter` resources — chapters inherit permissions from their parent novel:
 * - `read` - any authenticated user (user role or higher)
 * - `create` - admin OR (writer AND owns the parent novel, resolved from `resourceAttributes.novelId` since there's no chapter id yet)
 * - `update` - admin OR (writer AND owns the parent novel, resolved from the chapter's own id)
 */
@Injectable()
export class ChapterPolicy implements IResourcePolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: CustomLoggerService,
  ) {}

  async isAllowed({
    userId,
    userRoles,
    resourceId: chapterId,
    action,
    resourceAttributes,
  }: ResourcePolicyCheckParams): Promise<boolean> {
    switch (action) {
      case 'read':
        return hasMinimumRole(userRoles, Role.user);
      case 'create':
        return this.canCreate(userId, userRoles, resourceAttributes);
      case 'update':
        return this.canUpdate(userId, userRoles, chapterId);
      default:
        this.logger.warn(`Unknown chapter action: ${action}`);
        return false;
    }
  }

  private async canCreate(
    userId: string,
    userRoles: string[],
    resourceAttributes?: Record<string, string>,
  ): Promise<boolean> {
    if (isAdmin(userRoles)) {
      return true;
    }

    if (!hasMinimumRole(userRoles, Role.writer)) {
      return false;
    }

    const novelId = resourceAttributes?.novelId;

    if (!novelId) {
      this.logger.warn(
        'Missing novelId in resourceAttributes for chapter:create check',
      );
      return false;
    }

    return isNovelOwner(this.prisma, this.logger, userId, novelId);
  }

  private async canUpdate(
    userId: string,
    userRoles: string[],
    chapterId: string,
  ): Promise<boolean> {
    if (isAdmin(userRoles)) {
      return true;
    }

    if (!hasMinimumRole(userRoles, Role.writer)) {
      return false;
    }

    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { novel: { select: { ownerId: true } } },
    });

    if (!chapter) {
      this.logger.warn(`Chapter not found: ${chapterId}`);
      return false;
    }

    return chapter.novel.ownerId === userId;
  }
}
