describe('Request a category (e2e)', () => {
  /**
   * What only a real browser and a real login can show: the writer asks for a
   * category that does not exist from the create form, the request is accepted
   * without touching the form, and the novel is created without it. The same
   * name asked for again is refused inside the dialog.
   */
  it('requests a new category from the create form and creates the novel without it', () => {
    const suffix = Date.now();
    const novelName = `Cypress Category Novel ${suffix}`;
    const category = `cypress-request-${suffix}`;

    cy.login();
    cy.visit('/');
    cy.contains('button', 'New novel', { timeout: 15000 }).click();
    cy.url().should('match', /\/novels\/new$/);
    cy.get('input[placeholder="Novel name"]').type(novelName);

    // Ask for it
    cy.get('input[role="combobox"]').type(category);
    cy.contains('button', 'Request category', {
      timeout: 10000,
    }).click();
    cy.contains('[role="dialog"]', 'Request a category').within(
      () => {
        cy.contains('available after an admin approves it').should(
          'be.visible',
        );
        cy.get('input').should('have.value', category);
        cy.contains('button', 'Request category').click();
      },
    );
    cy.contains('[role="dialog"]').should('not.exist');
    cy.get('input[role="combobox"]').should('have.value', '');
    cy.get('[aria-label="Selected categories"]').should('not.exist');

    // Asking again is refused, naming the category
    cy.get('input[role="combobox"]').type(category);
    cy.contains('button', 'Request category', {
      timeout: 10000,
    }).click();
    cy.contains('[role="dialog"]', 'Request a category').within(
      () => {
        cy.contains('button', 'Request category').click();
        cy.get('[role="alert"]').should('contain', `"${category}"`);
        cy.contains('button', 'Cancel').click();
      },
    );

    // The novel is created without the pending category
    cy.contains('button', 'Create novel').click();
    cy.url().should('match', /\/novel\/[^/]+$/);
    cy.contains('h1', novelName, { timeout: 15000 }).should(
      'be.visible',
    );
    cy.contains(category).should('not.exist');
  });
});
