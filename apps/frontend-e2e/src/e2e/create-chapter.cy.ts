describe('Create Chapter (e2e)', () => {
  const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
  const NOVEL_URL = `/novel/${NOVEL_ID}`;

  /**
   * The only thing this spec exists to cover: real ZITADEL login/redirect and
   * a real create-chapter round trip against the real backend. UI states and
   * permission logic are already covered by Storybook (Step 3) and
   * backend-e2e (Step 2) — this stays minimal on purpose.
   */
  it('logs in as the novel owner, creates a chapter through the real UI/backend, and sees it in the chapter list', () => {
    const uniqueTitle = `Cypress Chapter ${Date.now()}`;

    cy.login();
    cy.intercept('POST', '**/graphql').as('graphql');

    cy.visit(NOVEL_URL);
    cy.wait('@graphql');

    cy.contains('button', 'New Chapter', { timeout: 10000 }).click();
    cy.url().should('match', /\/novel\/[^/]+\/chapters\/new$/);

    cy.get('input[placeholder="Chapter title"]', {
      timeout: 10000,
    }).type(uniqueTitle);
    cy.get(
      'textarea[placeholder="Chapter content in markdown format"]',
    ).type('# Cypress\n\nCreated by the create-chapter e2e journey.');

    cy.intercept('POST', '**/graphql').as('createChapter');
    cy.contains('button', 'Create Chapter').click();
    cy.wait('@createChapter');

    // Creation succeeded and landed on the new chapter's edit page.
    cy.url().should(
      'match',
      /\/novel\/[^/]+\/chapters\/[^/]+\/edit$/,
    );
    cy.get('input[placeholder="Chapter title"]', {
      timeout: 10000,
    }).should('have.value', uniqueTitle);

    // The new chapter shows up back on the chapter list.
    cy.visit(NOVEL_URL);
    cy.wait('@graphql');
    cy.contains(uniqueTitle, { timeout: 10000 }).should('be.visible');
  });
});
