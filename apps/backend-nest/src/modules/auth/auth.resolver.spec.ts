import { CustomLoggerService } from 'nestjs-backend-common';

import { AuthResolver } from './auth.resolver';

describe(AuthResolver.name, () => {
  let uut: AuthResolver;
  let logger: CustomLoggerService;

  beforeEach(() => {
    logger = {} as any;

    uut = new AuthResolver(logger);
  });

  it('should return authenticated user info', () => {
    const result = uut.whoAmI({
      sub: '234980127461293847',
      name: 'Admin User',
      givenName: 'Admin',
      familyName: 'Useri',
      preferredUsername: 'admin@admin.com',
      email: 'admin@admin.com',
      emailVerified: true,
      metadata: {},
      roles: [],
    });

    expect(result).toEqual({
      sub: '234980127461293847',
      name: 'Admin User',
      preferredUsername: 'admin@admin.com',
      email: 'admin@admin.com',
      roles: [],
      orgId: undefined,
      emailVerified: true,
    });
  });
});
