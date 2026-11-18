Cypress.Commands.add('waitForGraphQL', (operationName: string) => {
  cy.intercept('POST', '/graphql', (req) => {
    if (req.body.operationName === operationName) {
      req.alias = operationName;
    }
  });
});

const SEEDED_NOVELS = `query SeededNovels {
  novels(first: 50, where: { coverURLNotNil: true }) {
    edges {
      node {
        id
        chapters(first: 1) {
          totalCount
        }
      }
    }
  }
}`;

const SEEDED_TAG = `query SeededTag {
  tags(first: 1) {
    edges {
      node {
        name
      }
    }
  }
}`;

Cypress.Commands.add('seededNovelPath', () =>
  cy
    .request('POST', '/graphql', { query: SEEDED_NOVELS })
    .then(({ body }) => {
      const novels: {
        id: string;
        chapters: { totalCount: number };
      }[] = body.data.novels.edges.map(
        ({ node }: { node: never }) => node,
      );
      const novel = novels.find(
        (candidate) => candidate.chapters.totalCount > 0,
      );

      expect(novel, 'a generated novel with chapters').to.be.an(
        'object',
      );

      return `/novel/${novel?.id}`;
    }),
);

Cypress.Commands.add('seededTagName', () =>
  cy
    .request('POST', '/graphql', { query: SEEDED_TAG })
    .then(({ body }) => {
      const name: string | undefined =
        body.data.tags.edges[0]?.node.name;

      expect(name, 'a generated tag').to.be.a('string');

      return name as string;
    }),
);

export {};
