/// <reference types="cypress" />

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to wait for GraphQL response
       * @example cy.waitForGraphQL('novels')
       */
      waitForGraphQL(operationName: string): Chainable<void>;

      /**
       * Log in through ZITADEL's hosted login UI.
       * Defaults to the writer user (`Writer` / `Writer123!`).
       * @example cy.login()
       * @example cy.login('Admin', 'Admin123!')
       */
      login(username?: string, password?: string): Chainable<void>;

      logout(): Chainable<void>;

      /**
       * @description The path of a novel the seeder generated (the only ones with a cover) that has chapters.
       * @example
       * ```ts
       * cy.seededNovelPath().then((path) => cy.visit(path))
       * ````
       */
      seededNovelPath(): Chainable<string>;

      /**
       * @description The name of a tag the seeder generated.
       * @example
       * ```ts
       * cy.seededTagName().then((name) => cy.get('input[role="combobox"]').type(name))
       * ```
       */
      seededTagName(): Chainable<string>;
    }
  }
}

import './auth.commands';
import './graphql.commands';

export {};
