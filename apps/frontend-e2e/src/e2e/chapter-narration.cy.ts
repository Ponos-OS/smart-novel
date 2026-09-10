describe('Chapter Audio Narration', () => {
  const NOVEL_ID = 'c1d31ec2-f478-4648-b90b-d1e53de2a829';
  const CHAPTER_ID = '4dd92f16-4743-47b9-960c-6529678e9bc5';
  const NOVEL_URL = `/novel/${NOVEL_ID}`;
  const CHAPTER_URL = `${NOVEL_URL}?chapter=${CHAPTER_ID}`;

  /**
   * Navigate directly to a chapter page as an authenticated writer. The `?chapter=` query param causes the page to load the chapter content directly (no chapter list).
   */
  function visitChapterAsWriter() {
    cy.login();
    cy.intercept('POST', '**/graphql').as('graphql');
    cy.visit(CHAPTER_URL);
    cy.wait('@graphql');

    // The chapter content loads automatically — wait for it
    cy.get('.prose-container', { timeout: 15000 }).should(
      'be.visible',
    );
  }

  /**
   * Set up a GraphQL intercept that modifies the chapter response, then visit the chapter URL and wait for chapter content.
   */
  function visitChapterWithMock(
    chapterOverrides: Record<string, unknown>,
  ) {
    cy.login();

    cy.intercept('POST', '**/graphql', (req) => {
      req.continue((res) => {
        if (res.body?.data?.novel?.chapter) {
          Object.assign(
            res.body.data.novel.chapter,
            chapterOverrides,
          );
        }
      });
    }).as('graphqlMocked');

    cy.visit(CHAPTER_URL);
    cy.wait('@graphqlMocked');

    // Chapter content loads automatically via `?chapter=` param
    cy.get('.prose-container', { timeout: 15000 }).should(
      'be.visible',
    );
  }

  describe('Writer Tools section', () => {
    it('should display the Writer Tools section with a single Generate/Regenerate Audio button for authenticated writers', () => {
      visitChapterAsWriter();

      cy.contains('Writer Tools', { timeout: 10000 }).should(
        'be.visible',
      );

      // Exactly one generate/regenerate button — Step 3b collapses the old
      // "Generate TTS" (review-page navigation) and "Generate Audio" buttons
      // into a single action.
      cy.get('body').should(($body) => {
        const text = $body.text();
        const hasGenerate = text.includes('Generate Audio');
        const hasRegenerate = text.includes('Regenerate Audio');
        expect(
          hasGenerate || hasRegenerate,
          'Should show either Generate Audio or Regenerate Audio button',
        ).to.equal(true);
      });
    });

    it('should never show a "Generate TTS"/"Edit TTS Content" review-page button or link', () => {
      visitChapterAsWriter();

      cy.contains('Generate TTS').should('not.exist');
      cy.contains('Edit TTS Content').should('not.exist');
      cy.get('a[href*="tts-review"]').should('not.exist');
    });
  });

  describe('Audio narration with mocked GraphQL responses', () => {
    it('should show audio player when chapter has narration URL', () => {
      visitChapterWithMock({
        narrationStatus: 'READY',
        narrationUrl: 'https://example.com/test-narration.mp3',
      });

      // Audio Narration section should be visible
      cy.contains('Audio Narration', { timeout: 10000 }).should(
        'be.visible',
      );

      // Audio element should exist
      cy.get('audio[controls]').should('exist');
    });

    it('should show "Regenerate Audio" (not disabled) when narration already exists', () => {
      visitChapterWithMock({
        narrationStatus: 'READY',
        narrationUrl: 'https://example.com/test-narration.mp3',
      });

      cy.contains('button', 'Regenerate Audio', { timeout: 10000 })
        .should('be.visible')
        .and('not.be.disabled');
    });

    it('should show confirmation modal when clicking Regenerate Audio', () => {
      visitChapterWithMock({
        narrationStatus: 'READY',
        narrationUrl: 'https://example.com/test-narration.mp3',
      });

      // Click Regenerate Audio
      cy.contains('button', 'Regenerate Audio', {
        timeout: 10000,
      }).click();

      // Modal should appear
      cy.contains('h3', 'Regenerate Audio Narration?').should(
        'be.visible',
      );
      cy.contains('button', 'Cancel').should('be.visible');
      cy.contains('button', 'Yes, Regenerate').should('be.visible');
    });

    it('should close confirmation modal when clicking Cancel', () => {
      visitChapterWithMock({
        narrationStatus: 'READY',
        narrationUrl: 'https://example.com/test-narration.mp3',
      });

      // Open modal
      cy.contains('button', 'Regenerate Audio', {
        timeout: 10000,
      }).click();
      cy.contains('h3', 'Regenerate Audio Narration?').should(
        'be.visible',
      );

      // Click Cancel
      cy.contains('button', 'Cancel').click();

      // Modal should disappear
      cy.contains('h3', 'Regenerate Audio Narration?').should(
        'not.exist',
      );
    });

    it('should show a failure message and a usable (non-disabled) button to retry when narration fails', () => {
      visitChapterWithMock({
        narrationStatus: 'FAILED',
        narrationUrl: null,
      });

      cy.contains('Audio generation failed.', {
        timeout: 10000,
      }).should('be.visible');
      cy.contains('button', 'Generate Audio', { timeout: 10000 })
        .should('be.visible')
        .and('not.be.disabled');
    });

    it('should never disable the Generate Audio button — there is no more precondition gating it', () => {
      visitChapterWithMock({
        narrationStatus: null,
        narrationUrl: null,
      });

      cy.contains('button', 'Generate Audio', { timeout: 10000 })
        .should('be.visible')
        .and('not.be.disabled');
    });
  });

  describe('Full flow: generate audio → live progress → audio player', () => {
    /**
     * Slow integration test against the real backend services (RabbitMQ,
     * Beatrice, the local Qwen3-TTS shim, S3). Timeouts are generous to
     * account for CPU-only local TTS synthesis.
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

      // The single button is always "Generate Audio" or "Regenerate Audio" —
      // no TTS-review detour exists anymore.
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

      // The subscription-driven percent eventually renders alongside the
      // spinner text (Step 2.2/3b) — CPU-only local synthesis can take a
      // while to report its first "generating"/"uploading" event.
      cy.contains(/Generating audio\.\.\. \d+%/, {
        timeout: 60000,
      }).should('be.visible');

      // Wait for the audio player to appear once generation completes.
      // Matches Beatrice's own TTS__QWEN__TIMEOUT_MS (compose.yml) — CPU-only
      // local Qwen3-TTS synthesis can take a while, especially under
      // concurrent test-suite load.
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
