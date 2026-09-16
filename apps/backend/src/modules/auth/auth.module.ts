import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import {
  ASYNC_OPTIONS_TYPE,
  type AuthModuleOptions,
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from './auth.module-definition';
import { AuthResolver } from './auth.resolver';
import { CaslAbilityFactory } from './casl';
import { JwtAuthGuard, PoliciesGuard, RolesGuard } from './guards';
import { AUTH_PROVIDER, AUTHORIZATION_PROVIDER } from './interfaces';
import { ChapterPolicy, NovelPolicy } from './policies';
import {
  RbacAuthorizationProvider,
  ZitadelAuthProvider,
} from './providers';

/**
 * @description
 * Authentication & authorization module.
 *
 * Registers three global guards in order:
 * 1. `JwtAuthGuard` — **Authentication**: validates the Bearer JWT via JWKS and attaches `IAuthUser` to `request.user`.
 * 2. `PoliciesGuard` — **Authorization (resource gate)**: reads `@CheckPolicy()` metadata and delegates to `RbacAuthorizationProvider` for RBAC decisions.
 * 3. `RolesGuard` — **Authorization (role gate)**: reads `@RequireRole()` metadata and checks the user's highest role against the minimum required level.
 *
 * Use `@Public()` to bypass all guards on specific resolvers.
 *
 * `@Global()` so other feature modules (e.g. `NovelModule`) can inject exported policy classes
 * like `ChapterPolicy` directly — needed for resource-specific checks (e.g. novel ownership on
 * `createChapter`) that a resolver must call explicitly rather than route through
 * `@CheckPolicy()`'s generic mechanism. See `ChapterPolicy.assertCanCreateInNovel`.
 *
 * Authorization rules are declared as CASL abilities in `CaslAbilityFactory` — see
 * `NovelPolicy`/`ChapterPolicy` for how each resource's rules are checked.
 */
@Global()
@Module({})
export class AuthModule extends ConfigurableModuleClass {
  static override register(
    options: AuthModuleOptions,
  ): DynamicModule {
    return {
      module: AuthModule,
      providers: [
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
        ...AuthModule.coreProviders(),
      ],
      exports: [
        AUTHORIZATION_PROVIDER,
        AUTH_PROVIDER,
        PoliciesGuard,
        MODULE_OPTIONS_TOKEN,
        CaslAbilityFactory,
        NovelPolicy,
        ChapterPolicy,
      ],
    };
  }

  static override registerAsync(
    options: typeof ASYNC_OPTIONS_TYPE,
  ): DynamicModule {
    const baseModule = super.registerAsync(options);

    return {
      ...baseModule,
      providers: [
        ...(baseModule.providers || []),
        ...AuthModule.coreProviders(),
      ],
      exports: [
        ...((baseModule.exports as any[]) || []),
        AUTHORIZATION_PROVIDER,
        AUTH_PROVIDER,
        PoliciesGuard,
        MODULE_OPTIONS_TOKEN,
        CaslAbilityFactory,
        NovelPolicy,
        ChapterPolicy,
      ],
    };
  }

  /**
   * Shared providers used by both `register` and `registerAsync`.
   */
  private static coreProviders() {
    return [
      // Auth provider (JWKS-based JWT validation)
      ZitadelAuthProvider,
      {
        provide: AUTH_PROVIDER,
        useClass: ZitadelAuthProvider,
      },
      // Authorization provider (RBAC) — per-resource policies registered by the provider itself
      CaslAbilityFactory,
      NovelPolicy,
      ChapterPolicy,
      RbacAuthorizationProvider,
      {
        provide: AUTHORIZATION_PROVIDER,
        useClass: RbacAuthorizationProvider,
      },
      // Global authentication guard (validates Bearer JWT)
      {
        provide: APP_GUARD,
        useClass: JwtAuthGuard,
      },
      // Global authorization guard (reads @CheckPolicy() metadata)
      PoliciesGuard,
      {
        provide: APP_GUARD,
        useClass: PoliciesGuard,
      },
      // Global role-based guard (reads @RequireRole() metadata)
      RolesGuard,
      {
        provide: APP_GUARD,
        useClass: RolesGuard,
      },
      // GraphQL resolver
      AuthResolver,
    ];
  }
}
