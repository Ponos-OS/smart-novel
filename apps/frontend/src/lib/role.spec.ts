import cases from '../../../../spec/cases/role.json';
import { Role } from '../generated/shared';
import { hasMinimumRole, isAdmin, isWriterOrHigher } from './role';

describe('role helpers', () => {
  it.each(cases.hasMinimumRole)(
    'hasMinimumRole should return $expected for $roles against $minimum',
    ({ roles, minimum, expected }) => {
      const result = hasMinimumRole(roles, minimum as Role);

      expect(result).toBe(expected);
    },
  );

  it.each(cases.isAdmin)(
    'isAdmin should return $expected for $roles',
    ({ roles, expected }) => {
      const result = isAdmin(roles);

      expect(result).toBe(expected);
    },
  );

  it.each(cases.isWriterOrHigher)(
    'isWriterOrHigher should return $expected for $roles',
    ({ roles, expected }) => {
      const result = isWriterOrHigher(roles);

      expect(result).toBe(expected);
    },
  );
});
