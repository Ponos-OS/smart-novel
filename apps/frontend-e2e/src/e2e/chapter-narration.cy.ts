describe('Chapter Audio Narration', () => {
  describe('Full flow: generate audio → live progress → audio player', () => {
    /**
     * Slow integration test against the real backend services (RabbitMQ, Beatrice, the local TTS shim, S3). Timeouts are generous to account for CPU-only local TTS synthesis.
     */
    it('should generate audio directly (no TTS-review detour) and reflect live progress via the subscription', () => {
      cy.login();
      cy.intercept('POST', '**/graphql').as('graphql');

      // A novel of its own with a short chapter: Beatrice takes at most 4000 characters, so the generated chapters cannot be narrated.
      const novelName = `Narration Novel ${Date.now()}`;
      cy.visit('/');
      cy.contains('button', 'New novel', { timeout: 15000 }).click();
      cy.get('input[placeholder="Novel name"]').type(novelName);
      cy.contains('button', 'Create novel').click();
      cy.url().should('match', /\/novel\/[^/]+$/);
      cy.url().then((novelUrl) => {
        cy.contains('button', 'New Chapter', {
          timeout: 15000,
        }).click();
        cy.get('input[placeholder="Chapter title"]').type('The door');
        cy.get(
          'textarea[placeholder="Chapter content in markdown format"]',
        ).type('# The door\n\nThe door was there, in the fog.');
        cy.contains('button', 'Create Chapter').click();
        cy.url().should(
          'match',
          /\/novel\/[^/]+\/chapters\/[^/]+\/edit$/,
        );
        cy.visit(novelUrl);
      });
      cy.wait('@graphql');

      cy.contains('h3', /^Chapter 1:/, { timeout: 10000 })
        .first()
        .click();
      cy.wait('@graphql');

      cy.get('.prose-container', { timeout: 15000 }).should(
        'be.visible',
      );

      // The single button is always "Generate Audio" or "Regenerate Audio" — no TTS-review detour exists anymore.
      cy.get('body').then(($body) => {
        const hasExistingNarration = $body
          .text()
          .includes('Regenerate Audio');

        if (hasExistingNarration) {
          cy.contains('button', 'Regenerate Audio').click();
          cy.contains('h3', 'Regenerate Audio Narration?').should(
            'be.visible',
          );
          cy.contains('button', 'Yes, Regenerate').click();
        } else {
          cy.contains('button', 'Generate Audio', {
            timeout: 10000,
          }).click();
        }
      });

      // Wait for the audio player to appear once generation completes. The e2e stack answers from WireMock, so progress states are too short-lived to assert here; they are unit-tested in GenerateTtsButton.spec.tsx.
      cy.contains('Audio Narration', { timeout: 60000 }).should(
        'be.visible',
      );

      cy.get('audio[controls]').should('exist');
      cy.get('audio[controls]')
        .should('have.attr', 'src')
        .and('include', '.mp3');

      cy.contains('button', 'Regenerate Audio').should('be.visible');
    });
  });
});
