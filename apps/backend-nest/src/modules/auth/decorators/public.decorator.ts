import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = Symbol('isPublic');

/**
 * @description Marks a query/mutation/resolver as publicly accessible, bypassing authentication.
 *
 * Routes decorated with `@Public()` will not require a valid JWT Bearer token and will be accessible to unauthenticated users.
 *
 * @example
 * ```ts
 * @Public()
 * @Query(() => String)
 * health() {
 *   return 'ok';
 * }
 * ```
 */
export const Public = (): ClassDecorator & MethodDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
