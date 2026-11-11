import { subject } from '@casl/ability';

import { Action } from './action.enum';
import { CaslAbilityFactory } from './casl-ability.factory';

describe(CaslAbilityFactory.name, () => {
  let uut: CaslAbilityFactory;

  beforeEach(() => {
    uut = new CaslAbilityFactory();
  });

  describe('user role', () => {
    it('should allow reading anything', () => {
      const ability = uut.createForUser({
        sub: '234980127461293847',
        roles: ['user'],
      });

      expect(ability.can(Action.Read, 'Novel')).toBeTrue();
      expect(ability.can(Action.Read, 'Chapter')).toBeTrue();
    });

    it('should not allow creating or updating anything', () => {
      const ability = uut.createForUser({
        sub: '234980127461293847',
        roles: ['user'],
      });

      expect(ability.can(Action.Create, 'Novel')).toBeFalse();
      expect(ability.can(Action.Create, 'Chapter')).toBeFalse();
      expect(ability.can(Action.Update, 'Novel')).toBeFalse();
      expect(ability.can(Action.Update, 'Chapter')).toBeFalse();
    });
  });

  describe('writer role', () => {
    it('should allow creating a novel unconditionally', () => {
      const ability = uut.createForUser({
        sub: '234980127461293847',
        roles: ['writer'],
      });

      expect(ability.can(Action.Create, 'Novel')).toBeTrue();
    });

    it('should allow updating/deleting only a novel it owns', () => {
      const ability = uut.createForUser({
        sub: '234980127461293847',
        roles: ['writer'],
      });

      expect(
        ability.can(
          Action.Update,
          subject('Novel', { ownerId: '234980127461293847' }),
        ),
      ).toBeTrue();
      expect(
        ability.can(
          Action.Update,
          subject('Novel', { ownerId: '268103642598401' }),
        ),
      ).toBeFalse();
      expect(
        ability.can(
          Action.Delete,
          subject('Novel', { ownerId: '268103642598401' }),
        ),
      ).toBeFalse();
    });

    it('should allow creating/updating a chapter only in a novel it owns — regression test for an unconditional create rule silently bypassing ownership', () => {
      const ability = uut.createForUser({
        sub: '234980127461293847',
        roles: ['writer'],
      });

      expect(
        ability.can(
          Action.Create,
          subject('Chapter', { novelOwnerId: '234980127461293847' }),
        ),
      ).toBeTrue();
      expect(
        ability.can(
          Action.Create,
          subject('Chapter', { novelOwnerId: '268103642598401' }),
        ),
      ).toBeFalse();
      expect(
        ability.can(
          Action.Update,
          subject('Chapter', { novelOwnerId: '268103642598401' }),
        ),
      ).toBeFalse();
    });
  });

  describe('admin role', () => {
    it('should allow every action on every subject regardless of ownership', () => {
      const ability = uut.createForUser({
        sub: '234980127461293847',
        roles: ['admin'],
      });

      expect(
        ability.can(
          Action.Update,
          subject('Novel', { ownerId: '268103642598401' }),
        ),
      ).toBeTrue();
      expect(
        ability.can(
          Action.Delete,
          subject('Novel', { ownerId: '268103642598401' }),
        ),
      ).toBeTrue();
      expect(
        ability.can(
          Action.Create,
          subject('Chapter', { novelOwnerId: '268103642598401' }),
        ),
      ).toBeTrue();
    });
  });
});
