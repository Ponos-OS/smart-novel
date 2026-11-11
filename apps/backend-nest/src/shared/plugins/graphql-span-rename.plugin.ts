import { ApolloServerPlugin } from '@apollo/server';
import { trace } from '@opentelemetry/api';
import { OperationDefinitionNode } from 'graphql';

/**
 * @description Pulls a human-readable label out of an Apollo `requestContext` for span naming purposes.
 * @note we only look at the FIRST top-level selection. For multi-field anonymous operations (rare, mostly batched queries) the chosen label will not capture all roots — acceptable tradeoff since the span attributes still record the document.
 */
function getOperationLabel(
  operationName: string | null | undefined,
  operation: OperationDefinitionNode,
): string {
  if (operationName) {
    return operationName; // 👈 The document-level operation name (e.g. `mutation CreateNovel { ... }` → `CreateNovel`).
  }

  const firstSelection = operation.selectionSet.selections[0];

  if (firstSelection?.kind === 'Field') {
    return firstSelection.name.value; // 👈 The root selection field name (e.g. `mutation { explain(...) }` → `explain`).
  }

  return '<anonymous>'; // 👈 Fallback
}

/**
 * @summary renames the active OpenTelemetry the root span from the `POST /graphql` which is created by `@opentelemetry/instrumentation-http` to the GraphQL operation it carries, e.g. `mutation createNovel` or `query novels`. **Why**:
 *
 * - `instrumentation-http` names every span after the HTTP method + route (`POST /graphql`), which makes traces for different operations indistinguishable in Jaeger.
 * - `instrumentation-graphql` creates child spans (`graphql.parse`, `graphql.validate`, `graphql.execute`) but does NOT rename the parent HTTP span.
 * - Renaming on `didResolveOperation` means the operation has been parsed and validated, so `operationName`/`operation.operation` are reliably available.
 *
 * **Failure mode**:
 *
 * - If the request fails parsing or validation (no operation resolved), the span keeps its original `POST /graphql` name — by design, since we cannot tell mutation from query before parsing succeeds. The `graphql.parse` / `graphql.validate` child spans still carry the error.
 * - If no active span exists (e.g. instrumentation disabled), the hook is a no-op.
 */
export function graphqlSpanRenamePlugin(): ApolloServerPlugin {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation(requestContext): Promise<void> {
          const span = trace.getActiveSpan();

          if (!span) {
            return;
          }

          /**
           * @description set by Apollo before this hook fires, but its type is `OperationDefinitionNode | undefined` (the `didResolveOperation` context only marks `operationName` as required — see `@apollo/server/externalTypes/requestPipeline`).
           */
          const operation = requestContext.operation;

          if (!operation) {
            return;
          }

          const operationType = operation.operation;
          const operationLabel = getOperationLabel(
            requestContext.operationName,
            operation,
          );

          span.updateName(`${operationType} ${operationLabel}`);
          span.setAttribute('graphql.operation.type', operationType);
          span.setAttribute('graphql.operation.name', operationLabel);
        },
      };
    },
  };
}
