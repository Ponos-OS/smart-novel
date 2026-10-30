/**
 * Typing in a category field filters on the backend, and waits until the user
 * pauses: one request for the text, not one per key. Backend e2e covers the
 * filter itself (case, wildcards, paging).
 */
describe('Searching the categories (e2e)', () => {
  function recordSearches(operation: string) {
    const searches: (string | null)[] = [];

    cy.intercept('POST', '**/graphql', (request) => {
      if (request.body.query?.includes(`query ${operation}(`)) {
        searches.push(request.body.variables.search ?? null);
      }
    });

    return searches;
  }

  it('filters the categories of the search page as the user types', () => {
    const searches = recordSearches('FilterCategories');
    cy.visit('/search');
    cy.contains('h3', /include categories/i).should('be.visible');

    cy.get('input[aria-label="Search categories"]').type('fant', {
      delay: 40,
    });

    cy.contains('h3', /include categories/i)
      .parent()
      .find('button')
      .should('have.length', 1)
      .and('contain.text', 'Fantasy');
    cy.wrap(searches).should('deep.equal', [null, 'fant']);
  });

  it('matches the start of a category name, not a part from the middle', () => {
    cy.visit('/search');
    cy.get('input[aria-label="Search categories"]').type('ntas');

    cy.contains('h3', /include categories/i)
      .parent()
      .find('button')
      .should('not.exist');
  });

  it('shows what was picked even when the next search does not list it', () => {
    cy.visit('/search');
    cy.get('input[aria-label="Search categories"]').type('fant');
    cy.contains('h3', /include categories/i)
      .parent()
      .contains('button', 'Fantasy')
      .click();

    cy.get('input[aria-label="Search categories"]')
      .clear()
      .type('adven');

    cy.contains('h3', /include categories/i)
      .parent()
      .contains('button', 'Adventure')
      .should('be.visible');
    cy.contains('h3', /include categories/i)
      .parent()
      .contains('button', 'Fantasy')
      .should('have.attr', 'aria-pressed', 'true');
  });

  it('filters the suggestions of the novel form as the writer types', () => {
    const searches = recordSearches('SearchCategories');
    cy.login();
    cy.visit('/novels/new');
    cy.get('input[role="combobox"]').type('fant', { delay: 40 });

    cy.contains('[role="option"]', 'fantasy').should('be.visible');
    cy.get('[role="option"]').should('have.length', 1);
    cy.wrap(searches).should('deep.equal', [null, 'fant']);
  });
});
