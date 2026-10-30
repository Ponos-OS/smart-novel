// A valid 1x1 PNG.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('Manage a novel (e2e)', () => {
  /**
   * One journey as the writer through the real login, the real backend and the
   * real bucket. Permission rules are covered by backend-e2e and the UI states
   * by Storybook and unit tests; what only a real browser can show is the cover
   * `PUT` straight to the bucket (CORS included) and the pages reacting to
   * each other.
   */
  it('creates a novel, edits it, uploads a cover, adds two chapters, deletes the first and then the novel', () => {
    const suffix = Date.now();
    const novelName = `Cypress Novel ${suffix}`;
    const firstChapterTitle = `First chapter ${suffix}`;
    const secondChapterTitle = `Second chapter ${suffix}`;
    const description =
      'A lighthouse keeper finds a door in the fog.';

    cy.login();
    // Create
    cy.visit('/');
    cy.contains('button', 'New novel', { timeout: 15000 }).click();
    cy.url().should('match', /\/novels\/new$/);
    cy.get('input[placeholder="Novel name"]').type(novelName);
    cy.contains('button', 'Create novel').click();
    cy.url().should('match', /\/novel\/[^/]+$/);
    cy.contains('h1', novelName, { timeout: 15000 }).should(
      'be.visible',
    );

    cy.url().then((url) => {
      const novelId = url.split('/').pop() as string;
      const novelUrl = `/novel/${novelId}`;

      // Edit
      cy.contains('button', 'Edit novel').click();
      cy.url().should('match', /\/novels\/[^/]+\/edit$/);
      cy.get('textarea[placeholder="A short description"]').type(
        description,
      );
      cy.contains('label', 'State').find('select').select('Finished');
      // Search for it: the first page of suggestions is alphabetical
      cy.get('input[role="combobox"]').type('fantasy');
      cy.contains('[role="option"]', 'fantasy').click();
      cy.contains('button', 'Save').click();
      cy.url().should(
        'eq',
        `${Cypress.config('baseUrl')}${novelUrl}`,
      );
      cy.contains(description, { timeout: 15000 }).should(
        'be.visible',
      );
      cy.contains('fantasy').should('be.visible');

      // Upload a cover: the browser PUTs straight to the bucket
      cy.contains('button', 'Edit novel').click();
      cy.intercept('PUT', '**/covers/**').as('coverUpload');
      cy.get('[data-testid="cover-file-input"]').selectFile(
        {
          contents: Cypress.Buffer.from(PNG_BASE64, 'base64'),
          fileName: 'cover.png',
          mimeType: 'image/png',
        },
        { force: true },
      );
      cy.contains('cover.png').should('be.visible');
      cy.contains('button', 'Use this cover').click();
      cy.wait('@coverUpload')
        .its('response.statusCode')
        .should('eq', 200);
      cy.get(`img[alt="${novelName}"]`, { timeout: 15000 })
        .should('have.attr', 'src')
        .and('include', `covers/${novelId}/`);
      cy.get(`img[alt="${novelName}"]`).should(($image) => {
        expect($image.prop('naturalWidth')).to.be.gt(0);
      });

      // Add two chapters
      for (const title of [firstChapterTitle, secondChapterTitle]) {
        cy.visit(novelUrl);
        cy.contains('button', 'New Chapter', {
          timeout: 15000,
        }).click();
        cy.get('input[placeholder="Chapter title"]').type(title);
        cy.get(
          'textarea[placeholder="Chapter content in markdown format"]',
        ).type(`# ${title}\n\nWritten by the manage-novel journey.`);
        cy.contains('button', 'Create Chapter').click();
        cy.url().should(
          'match',
          /\/novel\/[^/]+\/chapters\/[^/]+\/edit$/,
        );
      }

      // Delete the first chapter: the second one becomes chapter 1
      cy.visit(novelUrl);
      cy.contains('h3', `Chapter 1: ${firstChapterTitle}`, {
        timeout: 15000,
      }).should('be.visible');
      cy.contains('h3', `Chapter 2: ${secondChapterTitle}`).should(
        'be.visible',
      );
      // The app sends only `query` and `variables`, so match on the query text. Registered right before the click, so the first GetNovel it sees is the refetch after the delete.
      cy.intercept('POST', '**/graphql', (request) => {
        if (request.body.query.includes('query GetNovel(')) {
          request.alias = 'getNovelAfterDelete';
        }
      });
      cy.get('button[title="Delete chapter"]').first().click();
      cy.get('[role="dialog"]').within(() => {
        cy.contains('button', 'Delete').click();
      });
      cy.wait('@getNovelAfterDelete').then(({ response }) => {
        const chapters =
          response?.body.data.novel.chaptersConnection.edges;

        expect(chapters).to.have.length(1);
        expect(chapters[0].node.title).to.eq(secondChapterTitle);
        expect(chapters[0].node.chapterNumber).to.eq(1);
      });
      cy.contains('h3', `Chapter 1: ${secondChapterTitle}`).should(
        'be.visible',
      );
      cy.contains(firstChapterTitle).should('not.exist');

      // Delete the novel: it asks for its name first
      cy.contains('button', 'Edit novel').click();
      cy.contains('button', 'Delete novel').click();
      cy.get('[role="dialog"]').within(() => {
        cy.contains('button', 'Delete').should('be.disabled');
        cy.get('input').type(novelName);
        cy.contains('button', 'Delete').should('be.enabled').click();
      });
      cy.url().should('eq', `${Cypress.config('baseUrl')}/`);

      cy.visit(novelUrl);
      cy.contains('Failed to fetch novel', { timeout: 15000 }).should(
        'be.visible',
      );
    });
  });
});
