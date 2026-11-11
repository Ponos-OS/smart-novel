import { UnauthorizedException } from '@nestjs/common';

import type { IAuthProvider } from '../../auth';

import { BeatriceTokenGuard } from './beatrice-token.guard';

describe(BeatriceTokenGuard.name, () => {
  let uut: BeatriceTokenGuard;
  let authProvider: IAuthProvider;

  beforeEach(() => {
    authProvider = {
      validateToken: vi.fn(),
      verifyIssuedByUs: vi.fn(),
    };

    uut = new BeatriceTokenGuard(authProvider);
  });

  it('should throw UnauthorizedException when no Authorization header is present', async () => {
    const context = mockHttpContext({});

    await expect(uut.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(authProvider.verifyIssuedByUs).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when the header is not a Bearer token', async () => {
    const context = mockHttpContext({
      authorization: 'Basic dXNlcjpwYXNz',
    });

    await expect(uut.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should allow access for a token that passes signature/issuer verification', async () => {
    const context = mockHttpContext({
      authorization: 'Bearer a-valid-token',
    });
    vi.mocked(authProvider.verifyIssuedByUs).mockResolvedValue(
      undefined,
    );

    const result = await uut.canActivate(context);

    expect(result).toBe(true);
    expect(authProvider.verifyIssuedByUs).toHaveBeenCalledWith(
      'a-valid-token',
    );
  });

  it('should allow access for a token that has expired but is otherwise valid', async () => {
    const context = mockHttpContext({
      authorization: 'Bearer an-expired-token',
    });
    vi.mocked(authProvider.verifyIssuedByUs).mockResolvedValue(
      undefined,
    );

    const result = await uut.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException for a tampered/wrong-issuer token', async () => {
    const context = mockHttpContext({
      authorization: 'Bearer a-tampered-token',
    });
    vi.mocked(authProvider.verifyIssuedByUs).mockRejectedValue(
      new Error('signature verification failed'),
    );

    await expect(uut.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

function mockHttpContext(headers: Record<string, string>): any {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  };
}
