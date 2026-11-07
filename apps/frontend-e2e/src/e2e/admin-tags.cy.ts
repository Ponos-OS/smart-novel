/**
 * Loaded directly, like a refresh or a pasted link: the ingress must serve the app for it, not ZITADEL (which lives on its own host).
 */
function openTagsPage() {
  cy.visit('/admin/tags');
  cy.get('button[aria-label="User menu"]', {
    timeout: 15000,
  }).should('be.visible');
  cy.url().should('match', /\/admin\/tags$/);
}

describe('Manage the tags (e2e)', () => {
  /**
   * The full journey with the two real logins, one step per test: Cypress
   * clears the browser between tests, and `cy.login()` restores the cached
   * session of each user, so the identity provider never sees two users at
   * once. The permission rules are covered by backend-e2e and the states of the
   * page by Storybook and unit tests.
   */
  const suffix = Date.now();
  const tag = `cypress-approve-${suffix}`;
  const novelName = `Cypress Approved Tag Novel ${suffix}`;

  it('lets the writer ask for a tag', () => {
    cy.login();
    cy.visit('/novels/new');
    cy.get('input[role="combobox"]').type(tag);
    cy.contains('button', 'Request tag', {
      timeout: 10000,
    }).click();
    cy.contains('[role="dialog"]', 'Request a tag').within(() => {
      cy.get('textarea').type('Created by the Cypress tag journey');
      cy.contains('button', 'Request tag').click();
    });
    cy.contains('[role="dialog"]').should('not.exist');
  });

  it('lets the admin find the request and approve it', () => {
    cy.login('Admin', 'Admin123!');
    openTagsPage();
    cy.get('input[aria-label="Search tags"]').type(tag);
    cy.contains('tr', tag, { timeout: 15000 }).within(() => {
      cy.contains('Pending').should('be.visible');
      cy.contains('button', 'Approve').click();
    });
    cy.contains('tr', tag).within(() => {
      cy.contains('Approved').should('be.visible');
      cy.contains('button', 'Approve').should('not.exist');
    });
  });

  it('lets the writer use the approved tag for a novel', () => {
    cy.login();
    cy.visit('/novels/new');
    cy.get('input[placeholder="Novel name"]').type(novelName);
    cy.get('input[role="combobox"]').type(tag);
    cy.contains('[role="option"]', tag, {
      timeout: 10000,
    }).click();
    cy.get('[aria-label="Selected tags"]').should('contain', tag);
    cy.contains('button', 'Create novel').click();
    cy.url().should('match', /\/novel\/[^/]+$/);
    cy.contains('h1', novelName, { timeout: 15000 }).should(
      'be.visible',
    );
    cy.contains(tag).should('be.visible');
  });

  it('lets the admin delete the tag again', () => {
    cy.login('Admin', 'Admin123!');
    openTagsPage();
    cy.get('input[aria-label="Search tags"]').type(tag);
    cy.contains('tr', tag, { timeout: 15000 }).within(() => {
      cy.get('button[aria-label^="Delete tag"]').click();
    });
    cy.contains(
      '[role="dialog"]',
      'will be removed from about',
    ).within(() => {
      cy.contains('button', 'Delete').click();
    });
    cy.contains('tr', tag).should('not.exist');
  });
});
