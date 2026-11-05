/**
 * @fileoverview
 * Reusable login helper for Cypress e2e tests against a hosted-login identity provider (currently ZITADEL Login V2, but the pattern below is provider-agnostic).
 *
 * Drives the full OIDC Authorization Code + PKCE flow through the provider's hosted login UI **once per session key** and caches the resulting cookies and storage with `cy.session()`. Subsequent calls to `cy.login()` restore the cached state instantly, so the slow hosted-login dance only runs once per test run (or until the `validate()` callback decides the cached session is stale).
 *
 * ## Why `cy.session()`
 *
 * By default, Cypress only resets cookies and storage between **specs**, not between **tests within a spec**. When a hosted-login helper calls `cy.visit('/')` and clicks "Login" without first clearing cookies, the identity provider sees an existing session for the OIDC `requestId` and may render a hybrid view that mixes a session-selection card with a fresh form. This produces duplicate input elements on the page and causes selector-based interactions (e.g. `cy.type()`) to fail with "subject contained N elements".
 *
 * The fix is structural rather than cosmetic: stop calling the login UI directly in every test. Instead, wrap the entire interactive login inside `cy.session()` keyed on the username. Cypress then:
 *
 * 1. Runs the interactive flow only when no valid session is cached.
 * 2. Persists cookies + `localStorage` + `sessionStorage` between tests (and across specs when `cacheAcrossSpecs: true` is set).
 * 3. Restores that snapshot before every test, optionally re-validating it with a cheap `validate()` callback before each restore.
 *
 * This pattern eliminates session leakage between tests, removes the race conditions that arise from re-entering the hosted-login UI while partially authenticated, and is the recommended approach for any Cypress suite that authenticates against an external IdP (ZITADEL, Auth0, Okta, FusionAuth, Keycloak, etc.).
 *
 * ## Changes vs. the previous implementation
 *
 * - The interactive flow was extracted into a private helper and is no longer invoked directly on every `cy.login()` call.
 * - `cy.session()` now owns session lifecycle, with a `validate()` hook and `cacheAcrossSpecs: true` to share the cached session between spec files in a single run.
 * - `logout` additionally calls `Cypress.session.clearAllSavedSessions()` so that a subsequent `cy.login()` does not restore the just-logged-out snapshot.
 *
 * Selectors are based on ZITADEL Login V2 `data-testid` attributes:
 * - https://github.com/zitadel/typescript/blob/main/acceptance/tests/loginname-screen.ts
 * - https://github.com/zitadel/typescript/blob/main/acceptance/tests/password-screen.ts
 */

import { log as baseLog } from '../logger';

// NOTE: Default credentials come from `infra/terraform/local/2-zitadel-config/main.tf`.
const DEFAULT_USERNAME = 'Writer';
const DEFAULT_PASSWORD = 'Writer123!';

const MAX_SUBMIT_RETRIES = 3;
const RETRY_WAIT_MS = 5000;

/**
 * @description ZITADEL is served on its own host (`auth.localhost`), so the login pages are another origin than the app and their commands have to run inside `cy.origin`.
 */
const ZITADEL_ORIGIN = 'http://auth.localhost:8080';

function log(message: string) {
  baseLog(`[AUTH] ${message}`);
}

interface ZitadelSignIn {
  username: string;
  password: string;
  maxRetries: number;
  retryWaitMs: number;
}

/**
 * @description Enters the username and the password on ZITADEL Login V2. It runs inside `cy.origin`, which serializes the callback, so it can use nothing from the rest of this file: its helpers are declared inside it.
 *
 * ZITADEL Login V2 sometimes swallows the submit-button click - the DOM element is visible and enabled, but the JS handler is not wired up yet (a race condition in their SPA hydration). The username step clicks submit and waits a short time for the password field; if it does not appear, it re-clicks up to `maxRetries` times before giving up. You cannot use a regular `for` loop for that: Cypress commands are enqueued, not run immediately.
 *
 * The password step ends with the click, because the redirect back to the app leaves this origin and nothing can be asserted on it from here.
 */
function signInOnZitadel({
  username,
  password,
  maxRetries,
  retryWaitMs,
}: ZitadelSignIn) {
  const passwordInput = '[data-testid="password-text-input"]';

  function note(message: string) {
    cy.task('log', `[AUTH] ${message}`, { log: false });
  }

  function submitUntilPasswordField(remaining: number) {
    note(
      `username submit: clicking (attempts left: ${remaining})...`,
    );

    cy.get('[data-testid="submit-button"]')
      .should('be.visible')
      .and('not.be.disabled')
      .click();
    cy.wait(retryWaitMs);

    cy.get('body').then(($body) => {
      if ($body.find(passwordInput).length > 0) {
        note('username submit: navigation succeeded');
        return;
      }

      if (remaining > 1) {
        note(
          'username submit: password field not found, retrying...',
        );
        submitUntilPasswordField(remaining - 1);
        return;
      }

      note('username submit: FAILED, exhausted all retries');
      cy.get(passwordInput, { timeout: 10000 }).should('exist');
    });
  }

  note('waiting for the username input...');
  cy.get('[data-testid="username-text-input"]', {
    timeout: 15000,
  }).type(username);
  submitUntilPasswordField(maxRetries);

  note('typing the password...');
  cy.get(passwordInput, { timeout: 15000 }).type(password, {
    log: false,
  });
  cy.get('[data-testid="submit-button"]')
    .should('be.visible')
    .and('not.be.disabled')
    .click();
}

Cypress.Commands.add(
  'login',
  (
    username: string = DEFAULT_USERNAME,
    password: string = DEFAULT_PASSWORD,
  ) => {
    cy.session(
      ['zitadel-login', username],
      () => performInteractiveLogin(username, password),
      {
        validate: validateSession,
        cacheAcrossSpecs: true,
      },
    );
  },
);

/**
 * @description Runs the full ZITADEL Login V2 OIDC flow. This is the *expensive* path — it walks the hosted login UI and submits username + password. Wrapped in `cy.session()` below so it only runs when there's no valid cached session.
 */
function performInteractiveLogin(username: string, password: string) {
  log(`=== LOGIN START (user: ${username}) ===`);

  // 1. Visit the home page and click the Login button
  log('Step 1: visiting home page...');
  cy.visit('/');

  log('Step 1: waiting for Login button...');
  cy.get('button[aria-label="Login"]', { timeout: 15000 })
    .should('be.visible')
    .and('not.be.disabled')
    .click();
  log('Step 1: Login button clicked');

  // 2. ZITADEL Login V2 - the username and the password, on the ZITADEL origin
  log('Step 2: signing in on ZITADEL...');
  cy.origin(
    ZITADEL_ORIGIN,
    {
      args: {
        username,
        password,
        maxRetries: MAX_SUBMIT_RETRIES,
        retryWaitMs: RETRY_WAIT_MS,
      },
    },
    signInOnZitadel,
  );

  // 4. Wait for the redirect back to the app and verify authentication
  cy.url({ timeout: 20000 }).should('not.include', '/ui/v2/login');

  cy.url().then((url) => log(`Step 4: URL after redirect: ${url}`));

  log('Step 5: waiting for User menu button (auth confirmation)...');
  cy.get('button[aria-label="User menu"]', {
    timeout: 15000,
  }).should('be.visible');

  cy.url().then((url) =>
    log(`=== LOGIN COMPLETE — final URL: ${url} ===`),
  );
}

/**
 * @description Lightweight check that the cached session is still valid. Cypress runs this after restoring cookies/storage; if it throws, the interactive login is re-run. Keep it cheap — it executes before every test.
 */
function validateSession() {
  log('Validating cached session...');
  cy.visit('/');
  cy.get('button[aria-label="User menu"]', { timeout: 10000 }).should(
    'be.visible',
  );
  log('Cached session is valid.');
}

Cypress.Commands.add('logout', () => {
  log('=== LOGOUT START ===');
  cy.visit('/');

  cy.get('body', { timeout: 15000 }).then(($body) => {
    if ($body.find('button[aria-label="User menu"]').length === 0) {
      log('User menu not found (already logged out)');
      return;
    }

    log('User menu found, opening dropdown...');
    cy.get('button[aria-label="User menu"]').click();

    log('Clicking Sign out...');
    cy.contains('[role="menuitem"]', 'Sign out')
      .should('be.visible')
      .click();

    cy.get('button[aria-label="Login"]', { timeout: 15000 }).should(
      'be.visible',
    );
  });

  cy.get('button[aria-label="Login"]')
    .should('be.visible')
    .and('not.be.disabled')
    .click();

  cy.clearAllCookies();
  cy.clearAllSessionStorage();
  cy.clearAllLocalStorage();

  // Invalidate any cached cy.session() entry so the next cy.login() call re-runs the interactive flow instead of restoring the just-logged-out state.
  Cypress.session.clearAllSavedSessions();

  log('=== LOGOUT COMPLETE ===');
});

export {};
