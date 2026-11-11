import { trace } from '@opentelemetry/api';
import {
  Kind,
  OperationDefinitionNode,
  OperationTypeNode,
} from 'graphql';

import { graphqlSpanRenamePlugin } from './graphql-span-rename.plugin';

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: vi.fn(),
  },
}));

describe(graphqlSpanRenamePlugin.name, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should rename the active (root) span using GraphQL operation type and operation name', async () => {
    // Arrange
    const span = {
      updateName: vi.fn(),
      setAttribute: vi.fn(),
    };
    vi.mocked(trace.getActiveSpan).mockReturnValue(span as never);
    const operation: OperationDefinitionNode = {
      kind: Kind.OPERATION_DEFINITION,
      operation: OperationTypeNode.MUTATION,
      name: {
        kind: Kind.NAME,
        value: 'CreateNovel',
      },
      variableDefinitions: [],
      directives: [],
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [
          {
            kind: Kind.FIELD,
            name: {
              kind: Kind.NAME,
              value: 'createNovel',
            },
            arguments: [],
            directives: [],
          },
        ],
      },
    };
    const plugin = graphqlSpanRenamePlugin();
    const listener = await plugin.requestDidStart?.({} as never);

    // Act
    await listener?.didResolveOperation?.({
      operationName: 'CreateNovel',
      operation,
    } as never);

    // Assert
    expect(span.updateName).toHaveBeenCalledWith(
      'mutation CreateNovel',
    );
    expect(span.setAttribute).toHaveBeenCalledWith(
      'graphql.operation.type',
      'mutation',
    );
    expect(span.setAttribute).toHaveBeenCalledWith(
      'graphql.operation.name',
      'CreateNovel',
    );
  });
});
