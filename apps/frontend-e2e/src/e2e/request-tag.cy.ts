describe('Request a tag (e2e)', () => {
  /**
   * What only a real browser and a real login can show: the writer asks for a
   * tag that does not exist from the create form, the request is accepted
   * without touching the form, and the novel is created without it. The same
   * name asked for again is refused inside the dialog.
   */
  it('requests a new tag from the create form and creates the novel without it', () => {
    const suffix = Date.now();
    const novelName = `Cypress Tag Novel ${suffix}`;
    const tag = `cypress-request-${suffix}`;

    cy.login();
    cy.visit('/');
    cy.contains('button', 'New novel', { timeout: 15000 }).click();
    cy.url().should('match', /\/novels\/new$/);
    cy.get('input[placeholder="Novel name"]').type(novelName);

    // Ask for it
    cy.get('input[role="combobox"]').type(tag);
    cy.contains('button', 'Request tag', {
      timeout: 10000,
    }).click();
    cy.contains('[role="dialog"]', 'Request a tag').within(() => {
      cy.contains('available after an admin approves it').should(
        'be.visible',
      );
      cy.get('input').should('have.value', tag);
      cy.get('textarea').type('Requested by the Cypress e2e suite.');
      cy.contains('button', 'Request tag').click();
    });
    cy.contains('[role="dialog"]').should('not.exist');
    cy.get('input[role="combobox"]').should('have.value', '');
    cy.get('[aria-label="Selected tags"]').should('not.exist');

    // Asking again is refused, naming the tag
    cy.get('input[role="combobox"]').type(tag);
    cy.contains('button', 'Request tag', {
      timeout: 10000,
    }).click();
    cy.contains('[role="dialog"]', 'Request a tag').within(() => {
      cy.contains('button', 'Request tag').click();
      cy.get('[role="alert"]').should('contain', `"${tag}"`);
      cy.contains('button', 'Cancel').click();
    });

    // The novel is created without the pending tag
    cy.contains('button', 'Create novel').click();
    cy.url().should('match', /\/novel\/[^/]+$/);
    cy.contains('h1', novelName, { timeout: 15000 }).should(
      'be.visible',
    );
    cy.contains(tag).should('not.exist');
  });
});
