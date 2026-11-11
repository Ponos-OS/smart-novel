import { Query, Resolver } from '@nestjs/graphql';
import { CustomLoggerService } from 'nestjs-backend-common';

import type { IAuthUser } from './interfaces';

import { CurrentUser } from './decorators';
import { WhoAmI } from './types';

@Resolver()
export class AuthResolver {
  constructor(private readonly logger: CustomLoggerService) {}

  @Query(() => WhoAmI, {
    description:
      "Return the authenticated user's profile from the JWT",
  })
  whoAmI(@CurrentUser() user: IAuthUser): WhoAmI {
    return {
      sub: user.sub,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      preferredUsername: user.preferredUsername,
      orgId: user.orgId,
      roles: user.roles,
    };
  }
}
