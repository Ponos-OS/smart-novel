import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { isNotEmpty } from 'class-validator';
import { decodeProtectedHeader } from 'jose';
import {
  CustomLoggerService,
  isNil,
  retryAsync,
} from 'nestjs-backend-common';

import { IS_PUBLIC_KEY } from '../decorators';
import { AUTH_PROVIDER, type IAuthProvider } from '../interfaces';
import { sanitizeKeyId } from '../utils';

/**
 * @description
 * GraphQL-aware JWT authentication guard.
 *
 * Use `@Public()` decorator to skip authentication for specific resolvers.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: IAuthProvider,
    private readonly reflector: Reflector,
    private readonly logger: CustomLoggerService,
  ) {}

  async canActivate(
    executionContext: ExecutionContext,
  ): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );
    const context = GqlExecutionContext.create(executionContext);
    const request = context.getContext().req;
    const token = this.extractTokenFromHeader(request);

    if (isPublic) {
      if (token) {
        // Soft auth: attempt to populate req.user if a token is present, but don't reject if missing or invalid — this is a public route.
        const [error, user] = await retryAsync(
          () => this.authProvider.validateToken(token),
          { retry: 0 },
        );

        if (isNotEmpty(error)) {
          this.logger.warn(
            `Ignoring invalid token on a public route (kid: ${sanitizeKeyId(this.getTokenKeyId(token))}): ${error}`,
          );
        }

        request.user = user;
      }

      return true;
    }

    if (!token) {
      throw new UnauthorizedException(
        'Missing Bearer token in Authorization header',
      );
    }

    const [error, user] = await retryAsync(
      () => this.authProvider.validateToken(token),
      { retry: 0 },
    );

    if (isNotEmpty(error) || isNil(user)) {
      this.logger.error(`Token validation failed: ${error}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = user;

    return true;
  }

  private getTokenKeyId(token: string): unknown {
    try {
      return decodeProtectedHeader(token).kid;
    } catch {
      return undefined;
    }
  }

  private extractTokenFromHeader(
    request: Record<string, unknown>,
  ): string | undefined {
    const headers = request.headers as Record<string, string>;
    const authorization = headers?.authorization;

    if (!authorization) {
      return undefined;
    }

    const [type, token] = authorization.split(' ');

    return type === 'Bearer' ? token : undefined;
  }
}
