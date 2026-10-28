/**
 * @description Application roles with implicit hierarchy
 *
 * Hierarchy: admin > writer > user
 */
export enum Role {
  admin = 'admin',
  user = 'user',
  writer = 'writer',
}

/**
 * @description Role hierarchy levels (higher number = more privileges)
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.admin]: 3,
  [Role.writer]: 2,
  [Role.user]: 1,
};

/**
 * @description Check if user has at least the minimum required role based on hierarchy
 *
 * @example
 * hasMinimumRole(['writer'], Role.user) // true (writer >= user)
 * hasMinimumRole(['user'], Role.writer) // false (user < writer)
 * hasMinimumRole(['admin'], Role.writer) // true (admin >= writer)
 */
export function hasMinimumRole(
  userRoles: string[],
  minimumRole: Role,
): boolean {
  // Get the highest role level the user has
  const userLevel = Math.max(
    ...userRoles.map((role) => ROLE_HIERARCHY[role as Role] || 0),
  );

  const requiredLevel = ROLE_HIERARCHY[minimumRole];

  return userLevel >= requiredLevel;
}

/**
 * @description Check if user has admin role
 */
export function isAdmin(userRoles: string[]): boolean {
  return userRoles.includes(Role.admin);
}

/**
 * @description Check if user has writer role or higher
 */
export function isWriterOrHigher(userRoles: string[]): boolean {
  return hasMinimumRole(userRoles, Role.writer);
}
