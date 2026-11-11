import { Role, ROLE_HIERARCHY } from '../generated/shared';

export function hasMinimumRole(
  userRoles: string[],
  minimumRole: Role,
): boolean {
  const userLevel = Math.max(
    0,
    ...userRoles.map((role) => ROLE_HIERARCHY[role as Role] ?? 0),
  );

  return userLevel >= ROLE_HIERARCHY[minimumRole];
}

export function isAdmin(userRoles: string[]): boolean {
  return userRoles.includes(Role.admin);
}

export function isWriterOrHigher(userRoles: string[]): boolean {
  return hasMinimumRole(userRoles, Role.writer);
}
