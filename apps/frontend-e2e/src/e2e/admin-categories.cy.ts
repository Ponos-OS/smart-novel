/**
 * Through the menu, not `cy.visit('/admin/categories')`: the ingress sends the
 * `/admin` prefix to ZITADEL's admin API, so loading that URL directly never
 * reaches the app.
 */
function openCategoriesPage() {
  cy.visit('/');
  cy.get('button[aria-label="User menu"]', {
    timeout: 15000,
  }).click();
  cy.contains('a', 'Manage categories').click();
  cy.url().should('match', /\/admin\/categories$/);
}

describe('Manage the categories (e2e)', () => {
  /**
   * The full journey with the two real logins, one step per test: Cypress
   * clears the browser between tests, and `cy.login()` restores the cached
   * session of each user, so the identity provider never sees two users at
   * once. The permission rules are covered by backend-e2e and the states of the
   * page by Storybook and unit tests.
   */
  const suffix = Date.now();
  const category = `cypress-approve-${suffix}`;
  const novelName = `Cypress Approved Category Novel ${suffix}`;

  it('lets the writer ask for a category', () => {
    cy.login();
    cy.visit('/novels/new');
    cy.get('input[role="combobox"]').type(category);
    cy.contains('button', 'Request category', {
      timeout: 10000,
    }).click();
    cy.contains('[role="dialog"]', 'Request a category').within(
      () => {
        cy.contains('button', 'Request category').click();
      },
    );
    cy.contains('[role="dialog"]').should('not.exist');
  });

  it('lets the admin find the request and approve it', () => {
    cy.login('Admin', 'Admin123!');
    openCategoriesPage();
    cy.get('input[aria-label="Search categories"]').type(category);
    cy.contains('tr', category, { timeout: 15000 }).within(() => {
      cy.contains('Pending').should('be.visible');
      cy.contains('button', 'Approve').click();
    });
    cy.contains('tr', category).within(() => {
      cy.contains('Approved').should('be.visible');
      cy.contains('button', 'Approve').should('not.exist');
    });
  });

  it('lets the writer use the approved category for a novel', () => {
    cy.login();
    cy.visit('/novels/new');
    cy.get('input[placeholder="Novel name"]').type(novelName);
    cy.get('input[role="combobox"]').type(category);
    cy.contains('[role="option"]', category, {
      timeout: 10000,
    }).click();
    cy.get('[aria-label="Selected categories"]').should(
      'contain',
      category,
    );
    cy.contains('button', 'Create novel').click();
    cy.url().should('match', /\/novel\/[^/]+$/);
    cy.contains('h1', novelName, { timeout: 15000 }).should(
      'be.visible',
    );
    cy.contains(category).should('be.visible');
  });

  it('lets the admin delete the category again', () => {
    cy.login('Admin', 'Admin123!');
    openCategoriesPage();
    cy.get('input[aria-label="Search categories"]').type(category);
    cy.contains('tr', category, { timeout: 15000 }).within(() => {
      cy.get('button[title="Delete category"]').click();
    });
    cy.contains(
      '[role="dialog"]',
      'will be removed from about',
    ).within(() => {
      cy.contains('button', 'Delete').click();
    });
    cy.contains('tr', category).should('not.exist');
  });
});
