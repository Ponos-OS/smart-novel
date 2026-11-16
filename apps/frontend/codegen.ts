import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '../backend/api/*.graphql',
  documents: 'src/**/*.graphql',
  generates: {
    'src/generated/graphql.ts': {
      plugins: [
        {
          add: {
            content: `import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: DocumentTypeDecoration<TResult, TVariables>['__apiType'];

  constructor(private value: string, public __meta__?: Record<string, any>) {
    super(value);
  }

  toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value as unknown as string & DocumentTypeDecoration<TResult, TVariables>;
  }
}`,
          },
        },
        'typescript',
        'typescript-operations',
        'typescript-react-query',
      ],
      config: {
        reactQueryVersion: 5,
        addSuspenseQuery: false,
        exposeQueryKeys: true,
        exposeFetcher: true,
        fetcher: '../lib/graphql-fetcher#graphqlFetcher',
      },
    },
  },
  ignoreNoDocuments: false,
};

export default config;
