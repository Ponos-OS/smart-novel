import { CustomLoggerService } from 'nestjs-backend-common';

import { CaslAbilityFactory } from '../casl';
import { LicensePolicy } from './license.policy';

describe(LicensePolicy.name, () => {
  let uut: LicensePolicy;
  let logger: CustomLoggerService;

  beforeEach(() => {
    logger = { warn: vi.fn() } as any;

    uut = new LicensePolicy(new CaslAbilityFactory(), logger);
  });

  describe('read', () => {
    it.each(['user', 'writer', 'admin'])(
      'should allow the %s role',
      async (role) => {
        const result = await uut.isAllowed({
          userId: '260311094522198751',
          userRoles: [role],
          resourceId: 'unknown',
          action: 'read',
        });

        expect(result).toBeTrue();
      },
    );
  });

  describe('update', () => {
    it('should allow an admin', async () => {
      const result = await uut.isAllowed({
        userId: '260311094522198751',
        userRoles: ['admin'],
        resourceId: 'unknown',
        action: 'update',
      });

      expect(result).toBeTrue();
    });

    it.each([['user'], ['writer'], []])(
      'should deny roles %s',
      async (...roles) => {
        const result = await uut.isAllowed({
          userId: '260311094522198751',
          userRoles: roles,
          resourceId: 'unknown',
          action: 'update',
        });

        expect(result).toBeFalse();
      },
    );
  });

  it.each(['create', 'delete', 'publish'])(
    'should deny the unsupported %s action even for an admin and log it',
    async (action) => {
      const result = await uut.isAllowed({
        userId: '260311094522198751',
        userRoles: ['admin'],
        resourceId: 'unknown',
        action,
      });

      expect(result).toBeFalse();
      expect(logger.warn).toHaveBeenCalledWith(
        `Unknown license action: ${action}`,
      );
    },
  );
});
