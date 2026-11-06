describe('Chapter Audio Narration', () => {
  const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
  const NOVEL_URL = `/novel/${NOVEL_ID}`;

  describe('Full flow: generate audio → live progress → audio player', () => {
    /**
     * Slow integration test against the real backend services (RabbitMQ, Beatrice, the local TTS shim, S3). Timeouts are generous to account for CPU-only local TTS synthesis.
     */
    it('should generate audio directly (no TTS-review detour) and reflect live progress via the subscription', () => {
      cy.login();
      cy.intercept('POST', '**/graphql').as('graphql');

      cy.visit(NOVEL_URL);
      cy.wait('@graphql');

      cy.contains('Chapter 1', { timeout: 10000 }).first().click();
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

      // Processing spinner appears immediately (optimistic update)
      cy.contains('Generating audio...', { timeout: 10000 }).should(
        'be.visible',
      );

      // The subscription-driven stage label eventually replaces the generic spinner text (Step 2.2/3b/5) — CPU-only local synthesis can take a while to report its first "queued"/"generating"/"uploading" event.
      cy.contains(/Queued\.\.\.|Generating\.\.\.|Uploading\.\.\./, {
        timeout: 60000,
      }).should('be.visible');

      // Wait for the audio player to appear once generation completes. Matches Beatrice's own TTS__TIMEOUT_MS (`infra/terraform/modules/beatrice`) — CPU-only local TTS synthesis can take a while, especially under concurrent test-suite load.
      cy.contains('Audio Narration', { timeout: 300000 }).should(
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
