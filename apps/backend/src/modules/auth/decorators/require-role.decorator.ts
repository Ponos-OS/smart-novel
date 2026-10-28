import { SetMetadata } from '@nestjs/common';
import { Role } from '@smart-novel/shared';

export const REQUIRE_ROLE_KEY = Symbol('requireRole');

/**
 * @description
 * Decorator to enforce a minimum role on a resolver/handler.
 * The `RolesGuard` reads this metadata and checks whether the authenticated
 * user's highest role meets or exceeds the required level.
 *
 * Use this for endpoints that are **not** tied to a specific resource
 * (no ownership check needed) — only a role gate.
 *
 * @example `@RequireRole(Role.writer)`
 */
export const RequireRole = (minimumRole: Role) =>
  SetMetadata(REQUIRE_ROLE_KEY, minimumRole);
