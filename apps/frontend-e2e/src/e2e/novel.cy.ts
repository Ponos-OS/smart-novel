/**
 * Routing-only smoke test: URL shape, refresh, and browser back/forward are the one
 * thing here that neither Storybook (component isolation) nor unit tests (jsdom, no real
 * browser navigation) can verify. Component-level behavior (edit-mode entry, the discard
 * confirmation, the 403 view, save/cancel flows) lives in `ChapterContentEditor.stories.tsx`
 * and the `.spec.tsx` unit tests instead.
 */
describe('Novel Page routing', () => {
  const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';

  it('uses path segments for chapter read/edit URLs and supports refresh and back/forward navigation', () => {
    cy.intercept('POST', '**/graphql').as('graphql');

    cy.visit(`/novel/${NOVEL_ID}`);
    cy.wait('@graphql');
    cy.url().should('match', /\/novel\/[^/]+$/);

    // Chapter list -> chapter read URL
    cy.contains('button', /chapter\s+\d+/i, { timeout: 10000 })
      .first()
      .click();
    cy.wait('@graphql');
    cy.url().should('match', /\/novel\/[^/]+\/chapters\/[^/]+$/);
    cy.get('.prose-container', { timeout: 10000 }).should(
      'be.visible',
    );

    // Refreshing the read URL directly shows the same content, no round-trip through the list
    cy.reload();
    cy.wait('@graphql');
    cy.get('.prose-container', { timeout: 10000 }).should(
      'be.visible',
    );

    // Browser back returns to the chapter list
    cy.go('back');
    cy.url().should('match', /\/novel\/[^/]+$/);
    cy.contains('h2', /chapters/i, { timeout: 10000 }).should(
      'be.visible',
    );

    // Browser forward returns to the chapter read view
    cy.go('forward');
    cy.url().should('match', /\/novel\/[^/]+\/chapters\/[^/]+$/);
    cy.get('.prose-container', { timeout: 10000 }).should(
      'be.visible',
    );
  });
});
