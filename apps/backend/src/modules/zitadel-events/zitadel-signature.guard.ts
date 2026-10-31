import type { Request } from 'express';

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  type AuthModuleOptions,
  MODULE_OPTIONS_TOKEN,
} from '../auth';

const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * @description Verifies the `ZITADEL-Signature` header (`t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`) of an Actions v2 call.
 */
@Injectable()
export class ZitadelSignatureGuard implements CanActivate {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { rawBody?: Buffer }>();
    const header = request.header('zitadel-signature');
    const timestamp = header?.match(/t=(\d+)/)?.[1];
    const signature = header?.match(/v1=([0-9a-f]+)/)?.[1];

    if (!timestamp || !signature || !request.rawBody) {
      throw new UnauthorizedException('Missing signature');
    }
    if (
      Math.abs(Date.now() / 1000 - Number(timestamp)) >
      SIGNATURE_TOLERANCE_SECONDS
    ) {
      throw new UnauthorizedException('Stale signature');
    }

    const expected = createHmac(
      'sha256',
      this.options.webhookSigningKey,
    )
      .update(`${timestamp}.`)
      .update(request.rawBody)
      .digest();
    const actual = Buffer.from(signature, 'hex');

    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new UnauthorizedException('Invalid signature');
    }

    return true;
  }
}
