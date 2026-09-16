import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { Injectable } from '@nestjs/common';

import { Role } from '../enums';
import { hasMinimumRole, isAdmin } from '../utils';
import { Action } from './action.enum';
import { AppAbility } from './app-ability.type';

/**
 * @description
 * Builds the CASL `Ability` for a user from their ZITADEL roles. Role hierarchy: admin >
 * writer > user.
 *
 * - `user` (any authenticated user): read everything.
 * - `writer`: additionally create novels/chapters, and update/delete a `Novel` (or update a
 *   `Chapter`) whose `ownerId`/`novelOwnerId` field matches their own id. These are real
 *   fields checked against a real (or stand-in, via CASL's `subject()` helper) object at
 *   check time — never a hand-picked attributes bag assembled per call site.
 * - `admin`: `manage` (CASL's "any action") on everything.
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: { sub: string; roles: string[] }): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (isAdmin(user.roles)) {
      can(Action.Manage, 'all');
      return build();
    }

    if (hasMinimumRole(user.roles, Role.user)) {
      can(Action.Read, 'all');
    }

    if (hasMinimumRole(user.roles, Role.writer)) {
      // Unconditional: creating a novel has no ownership prerequisite — the writer becomes its owner.
      can(Action.Create, 'Novel');
      can(Action.Update, 'Novel', { ownerId: user.sub });
      can(Action.Delete, 'Novel', { ownerId: user.sub });
      // Conditional: creating/updating a chapter requires owning its parent novel. This
      // condition is what `assertCanCreateInNovel`/`isAllowed`'s 'update' case actually enforce
      // against the real fetched `novelOwnerId` — an unconditional `can(Create, 'Chapter')`
      // here would make that enforcement a no-op, since an unconditional rule matches every
      // object of that subject type regardless of its fields.
      can(Action.Create, 'Chapter', { novelOwnerId: user.sub });
      can(Action.Update, 'Chapter', { novelOwnerId: user.sub });
    }

    return build();
  }
}
