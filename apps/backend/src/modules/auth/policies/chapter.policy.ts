import { ForbiddenError, subject } from '@casl/ability';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { CustomLoggerService } from 'nestjs-backend-common';

import type { IAuthUser } from '../interfaces';

import { PrismaService } from '../../prisma/prisma.service';
import { Action, CaslAbilityFactory } from '../casl';
import { isAdmin } from '../utils';
import {
  IResourcePolicy,
  ResourcePolicyCheckParams,
} from './resource-policy.interface';

/**
 * @description
 * Permission model for `chapter` resources, declared as CASL rules in
 * `CaslAbilityFactory` — chapters inherit permissions from their parent novel:
 * - `read` - any authenticated user
 * - `create` - writer or admin at the `@CheckPolicy()` gate (coarse role check only, no
 *   resource to identify yet); ownership of the target novel is then checked explicitly by
 *   the resolver via {@link assertCanCreateInNovel} — see that method's doc for why.
 * - `update` - admin OR (writer AND owns the parent novel, resolved from the chapter's own id
 *   and checked against the real fetched row via CASL's `subject()` helper)
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
    resourceId: chapterId,
    action,
  }: ResourcePolicyCheckParams): Promise<boolean> {
    const ability = this.caslAbilityFactory.createForUser({
      sub: userId,
      roles: userRoles,
    });

    switch (action) {
      case 'read':
        return ability.can(Action.Read, 'Chapter');
      case 'create':
        // Coarse role gate only — see assertCanCreateInNovel for the ownership check, which
        // the resolver calls explicitly with the real, already-typed novelId it's already using.
        return ability.can(Action.Create, 'Chapter');
      case 'update': {
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

  /**
   * @description
   * Asserts `user` may create a chapter in `novelId`, throwing `ForbiddenException` if not.
   * Deliberately **not** routed through `@CheckPolicy()`'s generic args-reflection mechanism:
   * at create time there's no chapter id for the guard to resolve a resource from, and a
   * previous version of this check pulled `novelId` out of an untyped, stringly-keyed
   * attributes bag with no compiler guarantee that its key actually matched what this method
   * read — a rename on either side failed silently. Call this directly from the resolver with
   * its own already-typed `novelId` argument instead, so there is exactly one variable, not
   * two spellings of the same string, to keep in sync.
   */
  async assertCanCreateInNovel(
    user: Pick<IAuthUser, 'sub' | 'roles'>,
    novelId: string,
  ): Promise<void> {
    if (isAdmin(user.roles)) {
      return;
    }

    const ability = this.caslAbilityFactory.createForUser(user);
    const novel = await this.prisma.novel.findUnique({
      where: { id: novelId },
      select: { ownerId: true },
    });

    try {
      ForbiddenError.from(ability).throwUnlessCan(
        Action.Create,
        subject('Chapter', { novelOwnerId: novel?.ownerId ?? null }),
      );
    } catch (error) {
      if (error instanceof ForbiddenError) {
        throw new ForbiddenException(
          'You do not have permission to create a chapter in this novel',
        );
      }

      throw error;
    }
  }
}
