import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import {
  isWriterOrHigher,
  PLATFORM_TERMS_NOT_ACCEPTED,
} from '@smart-novel/shared';
import { GraphQLError } from 'graphql';

import type { IAuthUser } from '../auth';

import { PlatformTermsService } from './platform-terms.service';

/**
 * @description Blocks a writer (or higher) who has not accepted the current platform terms. Runs after the global guards, so the user is already authenticated and authorized for the operation.
 */
@Injectable()
export class PlatformTermsGuard implements CanActivate {
  constructor(
    private readonly platformTermsService: PlatformTermsService,
  ) {}

  async canActivate(
    executionContext: ExecutionContext,
  ): Promise<boolean> {
    const request =
      GqlExecutionContext.create(executionContext).getContext().req;
    const user: IAuthUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException(
        'No authenticated user found for platform terms check',
      );
    }
    if (!isWriterOrHigher(user.roles)) {
      return true;
    }
    if (
      await this.platformTermsService.hasAcceptedCurrent(user.sub)
    ) {
      return true;
    }

    throw new GraphQLError(
      'You must accept the current platform terms first',
      {
        extensions: {
          code: PLATFORM_TERMS_NOT_ACCEPTED,
          status: HttpStatus.FORBIDDEN,
        },
      },
    );
  }
}
