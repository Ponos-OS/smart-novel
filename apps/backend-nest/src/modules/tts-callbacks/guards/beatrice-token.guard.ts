import type { Request } from 'express';

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { retryAsync } from 'nestjs-backend-common';

import { AUTH_PROVIDER, type IAuthProvider } from '../../auth';

/**
 * @description
 * Guards the REST callbacks Beatrice calls into (`genUploadUrl`). Unlike the global
 * `JwtAuthGuard`, this only checks the token's signature and issuer — an expired token
 * is accepted, since Beatrice may not pick the job off the queue until well after the
 * token that kicked off the job has expired.
 */
@Injectable()
export class BeatriceTokenGuard implements CanActivate {
  constructor(
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: IAuthProvider,
  ) {}

  async canActivate(
    executionContext: ExecutionContext,
  ): Promise<boolean> {
    const request = executionContext
      .switchToHttp()
      .getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(
        'Missing Bearer token in Authorization header',
      );
    }

    const [error] = await retryAsync(
      () => this.authProvider.verifyIssuedByUs(token),
      { retry: 0 },
    );

    if (error) {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractTokenFromHeader(
    request: Request,
  ): string | undefined {
    const [type, token] = (request.headers.authorization ?? '').split(
      ' ',
    );

    return type === 'Bearer' ? token : undefined;
  }
}
