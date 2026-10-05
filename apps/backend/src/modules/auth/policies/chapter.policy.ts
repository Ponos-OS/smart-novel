import { subject } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from 'nestjs-backend-common';

import { PrismaService } from '../../prisma/prisma.service';
import { Action, CaslAbilityFactory } from '../casl';
import { isAdmin } from '../utils';
import {
  IResourcePolicy,
  ResourcePolicyCheckParams,
} from './resource-policy.interface';

/**
 * @description
 * Permission model for `chapter` resources, declared as CASL rules in `CaslAbilityFactory`, chapters inherit permissions from their parent novel:
 * - Read: any authenticated user.
 * - Create: admin OR (writer AND owns the target novel).
 * - Update: admin OR (writer AND owns the parent novel, resolved from the chapter's own id and checked against the real fetched row via CASL's `subject()` helper).
 */
@Injectable()
export class ChapterPolicy implements IResourcePolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly logger: CustomLoggerService,
  ) {}

  async isAllowed({
    userId,
    userRoles,
    resourceId,
    action,
  }: ResourcePolicyCheckParams): Promise<boolean> {
    const ability = this.caslAbilityFactory.createForUser({
      sub: userId,
      roles: userRoles,
    });

    switch (action) {
      case 'read':
        return ability.can(Action.Read, 'Chapter');
      case 'create': {
        // resourceId is the target novel's id here (see @CheckPolicy('chapter', 'create', 'novelId')).
        if (isAdmin(userRoles)) {
          return true;
        }

        if (!ability.can(Action.Create, 'Chapter')) {
          return false;
        }

        const novel = await this.prisma.novel.findUnique({
          where: { id: resourceId },
          select: { ownerId: true },
        });

        if (!novel) {
          this.logger.warn(`Novel not found: ${resourceId}`);
          return false;
        }

        return ability.can(
          Action.Create,
          subject('Chapter', { novelOwnerId: novel.ownerId }),
        );
      }
      case 'update': {
        const chapterId = resourceId;

        // Admins bypass ownership entirely — skip the DB round trip. Non-admins with no
        // update rule at all (plain `user` role) are rejected the same way, without fetching
        // a row we'd never be allowed to act on regardless of who owns it.
        if (isAdmin(userRoles)) {
          return true;
        }

        if (!ability.can(Action.Update, 'Chapter')) {
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

        return ability.can(
          Action.Update,
          subject('Chapter', { novelOwnerId: chapter.novel.ownerId }),
        );
      }
      default:
        this.logger.warn(`Unknown chapter action: ${action}`);
        return false;
    }
  }
}
