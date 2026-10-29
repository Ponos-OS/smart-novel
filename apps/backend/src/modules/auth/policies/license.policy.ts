import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from 'nestjs-backend-common';

import { Action, CaslAbilityFactory } from '../casl';
import {
  IResourcePolicy,
  ResourcePolicyCheckParams,
} from './resource-policy.interface';

/**
 * @description
 * Permission model for `license` resources, declared as CASL rules in `CaslAbilityFactory`: read for any authenticated user, everything else (as of now only changing the default license, `update`) for admins. Licenses are immutable rows, and writers pick or draft one through the novel they own, so no writer rule is needed here.
 */
@Injectable()
export class LicensePolicy implements IResourcePolicy {
  constructor(
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly logger: CustomLoggerService,
  ) {}

  async isAllowed({
    userId,
    userRoles,
    action,
  }: ResourcePolicyCheckParams): Promise<boolean> {
    const ability = this.caslAbilityFactory.createForUser({
      sub: userId,
      roles: userRoles,
    });

    switch (action) {
      case 'read':
        return ability.can(Action.Read, 'License');
      case 'update':
        return ability.can(Action.Update, 'License');
      default:
        this.logger.warn(`Unknown license action: ${action}`);
        return false;
    }
  }
}
