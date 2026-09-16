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
 * Permission model for `novel` resources, declared as CASL rules in
 * `CaslAbilityFactory` — read for any authenticated user, create for writer/admin,
 * update/delete for admin OR the novel's own owner. `update`/`delete` fetch the real
 * `Novel` row and check the ability against it (via CASL's `subject()` helper), not
 * against a hand-picked id comparison.
 */
@Injectable()
export class NovelPolicy implements IResourcePolicy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly logger: CustomLoggerService,
  ) {}

  async isAllowed({
    userId,
    userRoles,
    resourceId: novelId,
    action,
  }: ResourcePolicyCheckParams): Promise<boolean> {
    const ability = this.caslAbilityFactory.createForUser({
      sub: userId,
      roles: userRoles,
    });

    switch (action) {
      case 'read':
        return ability.can(Action.Read, 'Novel');
      case 'create':
        return ability.can(Action.Create, 'Novel');
      case 'update':
      case 'delete': {
        const caslAction =
          action === 'update' ? Action.Update : Action.Delete;

        // Admins bypass ownership entirely — skip the DB round trip. Non-admins with no
        // update/delete rule at all (plain `user` role) are rejected the same way, without
        // fetching a row we'd never be allowed to act on regardless of who owns it.
        if (isAdmin(userRoles)) {
          return true;
        }

        if (!ability.can(caslAction, 'Novel')) {
          return false;
        }

        const novel = await this.prisma.novel.findUnique({
          where: { id: novelId },
          select: { ownerId: true },
        });

        if (!novel) {
          this.logger.warn(`Novel not found: ${novelId}`);
          return false;
        }

        return ability.can(caslAction, subject('Novel', novel));
      }
      default:
        this.logger.warn(`Unknown novel action: ${action}`);
        return false;
    }
  }
}
