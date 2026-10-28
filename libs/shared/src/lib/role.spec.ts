import {
  hasMinimumRole,
  isAdmin,
  isWriterOrHigher,
  Role,
} from './role';

describe('role helpers', () => {
  describe(hasMinimumRole.name, () => {
    it.each([
      { roles: ['writer'], minimum: Role.user, expected: true },
      { roles: ['user'], minimum: Role.writer, expected: false },
      { roles: ['admin'], minimum: Role.writer, expected: true },
      {
        roles: ['user', 'writer'],
        minimum: Role.writer,
        expected: true,
      },
      {
        roles: ['unknown-role'],
        minimum: Role.user,
        expected: false,
      },
      { roles: [], minimum: Role.user, expected: false },
    ])(
      'should return $expected for $roles against $minimum',
      ({ roles, minimum, expected }) => {
        const result = hasMinimumRole(roles, minimum);

        expect(result).toBe(expected);
      },
    );
  });

  describe(isAdmin.name, () => {
    it.each([
      { roles: ['admin'], expected: true },
      { roles: ['writer'], expected: false },
      { roles: [], expected: false },
    ])(
      'should return $expected for $roles',
      ({ roles, expected }) => {
        const result = isAdmin(roles);

        expect(result).toBe(expected);
      },
    );
  });

  describe(isWriterOrHigher.name, () => {
    it.each([
      { roles: ['admin'], expected: true },
      { roles: ['writer'], expected: true },
      { roles: ['user'], expected: false },
      { roles: [], expected: false },
    ])(
      'should return $expected for $roles',
      ({ roles, expected }) => {
        const result = isWriterOrHigher(roles);

        expect(result).toBe(expected);
      },
    );
  });
});
