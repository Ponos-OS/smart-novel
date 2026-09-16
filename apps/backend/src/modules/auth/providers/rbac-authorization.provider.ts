import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from 'nestjs-backend-common';

import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../enums';
import {
  AuthzCheckParams,
  type IAuthorizationProvider,
} from '../interfaces';
import { hasMinimumRole, isAdmin } from '../utils';

/**
 * @description
 * RBAC authorization provider that implements role-based access control with ownership checks.
 *
 * **Role Hierarchy:** admin > writer > user
 *
 * **Permission Model:**
 * - `novel:read` - Any authenticated user (user role or higher)
 * - `novel:create` - writer or admin
 * - `novel:update` - admin OR (writer AND owner)
 * - `novel:delete` - admin OR (writer AND owner)
 * - `chapter:read` - Any authenticated user (user role or higher)
 * - `chapter:update` - admin OR (writer AND owns parent novel)
 *
 * Roles are extracted from IAuthUser.roles[] (populated by Zitadel tokens).
 */
@Injectable()
export class RbacAuthorizationProvider implements IAuthorizationProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.log('RBAC authorization provider initialized');
  }

  async isAllowed(params: AuthzCheckParams): Promise<boolean> {
    const {
      principal,
      resource,
      resourceId,
      action,
      resourceAttributes,
    } = params;

    let allowed = false;

    // Route to appropriate permission check based on resource type
    switch (resource) {
      case 'novel':
        allowed = await this.checkNovelPermission(
          principal.sub,
          principal.roles,
          resourceId,
          action,
        );
        break;
      case 'chapter':
        allowed = await this.checkChapterPermission(
          principal.sub,
          principal.roles,
          resourceId,
          action,
          resourceAttributes,
        );
        break;
      default:
        this.logger.warn(
          `Unknown resource type: ${resource}. Denying access.`,
        );
        allowed = false;
    }

    this.logger.debug(
      `RBAC check: principal=${principal.sub} roles=[${principal.roles.join(',')}] action=${action} resource=${resource}/${resourceId} => ${allowed ? 'ALLOW' : 'DENY'}`,
    );

    return allowed;
  }

  /**
   * @description Check permissions for novel resources
   */
  private async checkNovelPermission(
    userId: string,
    userRoles: string[],
    novelId: string,
    action: string,
  ): Promise<boolean> {
    this.logger.log(
      '{ userId, userRoles, novelId, action }: ' +
        JSON.stringify(
          { userId, userRoles, novelId, action },
          null,
          2,
        ),
    );

    switch (action) {
      case 'read':
        return hasMinimumRole(userRoles, Role.user);
      case 'create':
        return hasMinimumRole(userRoles, Role.writer);
      case 'update':
      case 'delete':
        // Admins can do anything
        if (isAdmin(userRoles)) {
          return true;
        }

        // Writers can only update/delete their own novels
        if (hasMinimumRole(userRoles, Role.writer)) {
          const res = await this.isNovelOwner(userId, novelId);
          return res;
        }

        return false;
      default:
        this.logger.warn(`Unknown novel action: ${action}`);
        return false;
    }
  }

  /**
   * @description Check permissions for chapter resources
   * Chapters inherit permissions from their parent novel
   */
  private async checkChapterPermission(
    userId: string,
    userRoles: string[],
    chapterId: string,
    action: string,
    resourceAttributes?: Record<string, string>,
  ): Promise<boolean> {
    switch (action) {
      case 'read':
        return hasMinimumRole(userRoles, Role.user);
      case 'create': {
        // Admins can do anything
        if (isAdmin(userRoles)) {
          return true;
        }

        // Writers can only create chapters on novels they own. There is no
        // chapterId yet, so ownership is resolved via the novelId the
        // mutation was called with.
        if (hasMinimumRole(userRoles, Role.writer)) {
          const novelId = resourceAttributes?.novelId;

          if (!novelId) {
            this.logger.warn(
              'Missing novelId in resourceAttributes for chapter:create check',
            );
            return false;
          }

          return this.isNovelOwner(userId, novelId);
        }

        return false;
      }
      case 'update':
        // Admins can do anything
        if (isAdmin(userRoles)) {
          return true;
        }

        // Writers can only update chapters of novels they own
        if (hasMinimumRole(userRoles, Role.writer)) {
          // Fetch the chapter's parent novel and check ownership
          const chapter = await this.prisma.chapter.findUnique({
            where: { id: chapterId },
            select: {
              novel: {
                select: { ownerId: true },
              },
            },
          });

          if (!chapter) {
            this.logger.warn(`Chapter not found: ${chapterId}`);
            return false;
          }

          const isOwner = chapter.novel.ownerId === userId;

          return isOwner;
        }

        return false;

      default:
        this.logger.warn(`Unknown chapter action: ${action}`);
        return false;
    }
  }

  /**
   * @description Check if user owns a novel
   */
  private async isNovelOwner(
    userId: string,
    novelId: string,
  ): Promise<boolean> {
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      select: { ownerId: true },
    });

    if (!novel) {
      this.logger.warn(`Novel not found: ${novelId}`);
      return false;
    }

    return novel.ownerId === userId;
  }
}
