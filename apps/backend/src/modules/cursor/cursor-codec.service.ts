import type { ConfigType } from '@nestjs/config';

import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { appConfigs } from '../../app/configs/app.config';

interface CursorPayload {
  /** @description Identity of the query the cursor belongs to */
  a: string;
  /** @description Position: the id of the last row of the page */
  k: [string];
}

/**
 * @description Opaque cursor: `<base64url JSON payload>.<base64url HMAC-SHA256 of that payload>`.
 */
@Injectable()
export class CursorCodec {
  private readonly signingSecret: string;

  constructor(
    @Inject(appConfigs.KEY)
    appConfig: ConfigType<typeof appConfigs>,
  ) {
    this.signingSecret = appConfig.CURSOR_SIGNING_SECRET;
  }

  encode(audience: string, id: string): string {
    const payload: CursorPayload = { a: audience, k: [id] };
    const body = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );

    return `${body}.${this.sign(body).toString('base64url')}`;
  }

  /**
   * @returns The id of the row the cursor points at
   * @throws {BadRequestException} When the cursor was not issued by us, was changed, or belongs to another query
   */
  decode(cursor: string, audience: string): string {
    const [body, signature, ...rest] = cursor.split('.');

    if (!body || !signature || rest.length > 0) {
      throw new BadRequestException('Invalid cursor');
    }

    const actual = Buffer.from(signature, 'base64url');
    const expected = this.sign(body);

    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new BadRequestException('Invalid cursor');
    }

    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf-8'),
    ) as Partial<CursorPayload>;
    const id = payload.k?.[0];

    if (
      payload.a !== audience ||
      payload.k?.length !== 1 ||
      !id ||
      !isUUID(id)
    ) {
      throw new BadRequestException('Invalid cursor');
    }

    return id;
  }

  private sign(body: string): Buffer {
    return createHmac('sha256', this.signingSecret)
      .update(body)
      .digest();
  }
}
