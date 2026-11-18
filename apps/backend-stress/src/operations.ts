const documents = [
  open('../../frontend/src/pages/home/home.graphql'),
  open('../../frontend/src/pages/search/search.graphql'),
  open('../../frontend/src/pages/novel/novel.graphql'),
  open('../../frontend/src/pages/novel/novel-form.graphql'),
  open('../../frontend/src/pages/novel/tags.graphql'),
  open('../../frontend/src/hooks/chapter-user-state.graphql'),
  open(
    '../../frontend/src/features/platform-terms/platform-terms.graphql',
  ),
];

const operationStart = /^(?:query|mutation)\s+(\w+)/gm;

/**
 * @description The operations the UI sends, cut out of its `.graphql` documents, so the load test sends what the browser sends.
 */
const operations = new Map<string, string>();

for (const document of documents) {
  const starts = [...document.matchAll(operationStart)];

  starts.forEach((start, index) => {
    const end = starts[index + 1]?.index ?? document.length;

    operations.set(start[1], document.slice(start.index, end));
  });
}

export function operation(name: string): string {
  const found = operations.get(name);
  if (!found) {
    throw new Error(
      `operation ${name} is not in the frontend documents`,
    );
  }

  return found;
}
