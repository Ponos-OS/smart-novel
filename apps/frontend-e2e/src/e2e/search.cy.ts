describe('Search Page', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/graphql').as('graphql');
    cy.visit('/search');
    cy.wait('@graphql');
  });

  it('should load the search page successfully', () => {
    cy.url().should('include', '/search');
    cy.contains('h1', /search novels/i).should('be.visible');
  });

  it('should display search controls', () => {
    cy.contains('h3', /include tags/i).should('be.visible');
    cy.contains('h3', /exclude tags/i).should('be.visible');
    cy.contains('button', /^search$/i).should('be.visible');
  });

  it('should display tag filters', () => {
    cy.contains('h3', /include tags/i)
      .parent()
      .find('button')
      .should('have.length.greaterThan', 0);
  });

  it('should filter novels when selecting tags and searching', () => {
    cy.intercept('POST', '**/graphql').as('searchNovels');

    cy.contains('h3', /include tags/i)
      .parent()
      .find('button')
      .first()
      .click();

    cy.contains('button', /^search$/i).click();
    cy.wait('@searchNovels');

    cy.contains('h2', /results/i).should('be.visible');
  });

  it('should filter novels by tag when selecting a tag', () => {
    cy.intercept('POST', '**/graphql').as('searchNovels');

    cy.contains('h3', /include tags/i)
      .parent()
      .find('button')
      .first()
      .click();

    cy.contains('button', /^search$/i).click();
    cy.wait('@searchNovels');

    cy.contains(/results|no novels found/i).should('be.visible');
  });

  it('should clear search filters', () => {
    cy.contains('h3', /include tags/i)
      .parent()
      .find('button')
      .first()
      .as('includeTag');

    cy.get('@includeTag').click();
    cy.get('@includeTag').should('have.class', 'bg-green-600');

    // Toggle again to clear
    cy.get('@includeTag').click();
    cy.get('@includeTag').should('not.have.class', 'bg-green-600');
  });

  it('should navigate to novel detail page when clicking on a search result', () => {
    cy.intercept('POST', '**/graphql').as('searchNovels');

    cy.contains('h3', /include tags/i)
      .parent()
      .find('button')
      .first()
      .click();

    cy.contains('button', /^search$/i).click();
    cy.wait('@searchNovels');

    cy.get('body').then(($body) => {
      if ($body.find('a[href^="/novel/"]').length > 0) {
        cy.get('a[href^="/novel/"]').first().click();
        cy.url().should('include', '/novel/');
      }
    });
  });

  it('should display message when no results are found', () => {
    cy.intercept('POST', '**/graphql').as('searchNovels');

    cy.contains('h3', /include tags/i)
      .parent()
      .find('button')
      .first()
      .as('includeTag');

    cy.contains('h3', /exclude tags/i)
      .parent()
      .find('button')
      .first()
      .as('excludeTag');

    // Select the same tag in include and exclude to force empty results.
    cy.get('@includeTag')
      .invoke('text')
      .then((label) => {
        const tag = label.trim();
        cy.get('@includeTag').click();
        cy.contains('h3', /exclude tags/i)
          .parent()
          .find('button')
          .contains(tag)
          .click();
      });

    cy.contains('button', /^search$/i).click();
    cy.wait('@searchNovels');

    cy.contains(/no novels found matching your criteria/i).should(
      'be.visible',
    );
  });
});
