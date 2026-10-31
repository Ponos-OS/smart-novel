import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';

import { AuthModuleOptions } from '../auth';
import { ZitadelSignatureGuard } from './zitadel-signature.guard';

describe(ZitadelSignatureGuard.name, () => {
  const webhookSigningKey = 'whsk_7d2f9a41c3b84e60a5d1f08b92c7e354';
  const rawBody = Buffer.from(
    '{"aggregateID":"364554362883670018","event_type":"user.human.added"}',
  );
  let uut: ZitadelSignatureGuard;

  const sign = (timestamp: number, key = webhookSigningKey) =>
    `t=${timestamp},v1=${createHmac('sha256', key)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest('hex')}`;
  const contextOf = (
    header?: string,
    body: Buffer | null = rawBody,
  ) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          header: () => header,
          rawBody: body,
        }),
      }),
    }) as unknown as ExecutionContext;
  const now = () => Math.floor(Date.now() / 1000);

  beforeEach(() => {
    uut = new ZitadelSignatureGuard({
      webhookSigningKey,
    } as AuthModuleOptions);
  });

  it('should accept a body signed with the key', () => {
    const result = uut.canActivate(contextOf(sign(now())));

    expect(result).toBeTrue();
  });

  it.each([
    ['no header', undefined],
    ['a header without a signature', `t=${now()}`],
    ['a signature made with another key', sign(now(), 'whsk_other')],
    ['a signature that is not hex', `t=${now()},v1=zz`],
    ['a stale timestamp', sign(now() - 3600)],
  ])('should reject %s', (_name, header) => {
    expect(() => uut.canActivate(contextOf(header))).toThrow(
      UnauthorizedException,
    );
  });

  it('should reject a request without its raw body', () => {
    expect(() =>
      uut.canActivate(contextOf(sign(now()), null)),
    ).toThrow(UnauthorizedException);
  });
});
