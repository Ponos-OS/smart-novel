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
 * Permission model for `novel` resources:
 * - `read` - any authenticated user (user role or higher)
 * - `create` - writer or admin
 * - `update`/`delete` - admin OR (writer AND owner)
 */
@Injectable()
export class NovelPolicy implements IResourcePolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: CustomLoggerService,
  ) {}

  async isAllowed({
    userId,
    userRoles,
    resourceId: novelId,
    action,
  }: ResourcePolicyCheckParams): Promise<boolean> {
    switch (action) {
      case 'read':
        return hasMinimumRole(userRoles, Role.user);
      case 'create':
        return hasMinimumRole(userRoles, Role.writer);
      case 'update':
      case 'delete':
        if (isAdmin(userRoles)) {
          return true;
        }

        if (hasMinimumRole(userRoles, Role.writer)) {
          return isNovelOwner(
            this.prisma,
            this.logger,
            userId,
            novelId,
          );
        }

        return false;
      default:
        this.logger.warn(`Unknown novel action: ${action}`);
        return false;
    }
  }
}
