package server

import (
	"context"
	"net/http"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const anonymousOperation = "<anonymous>"

type spanNameKey struct{}

// spanName carries the operation name from the GraphQL layer back to otelhttp, which renames the span from the route once the handler returns.
type spanName struct{ value string }

func withSpanName(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), spanNameKey{}, &spanName{})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func formatSpanName(operation string, r *http.Request) string {
	if name, ok := r.Context().Value(spanNameKey{}).(*spanName); ok && name.value != "" {
		return name.value
	}

	return operation + " " + r.Method + " " + r.URL.Path
}

// operationSpan names the request span after the GraphQL operation and tags it, so traces can be told apart and the collector can drop the health check by graphql.operation.name.
type operationSpan struct{}

var (
	_ graphql.HandlerExtension        = operationSpan{}
	_ graphql.OperationContextMutator = operationSpan{}
)

func (operationSpan) ExtensionName() string { return "OperationSpan" }

func (operationSpan) Validate(graphql.ExecutableSchema) error { return nil }

func (operationSpan) MutateOperationContext(ctx context.Context, operation *graphql.OperationContext) *gqlerror.Error {
	label := operationLabel(operation.OperationName, operation.Operation)
	kind := string(operation.Operation.Operation)
	if name, ok := ctx.Value(spanNameKey{}).(*spanName); ok {
		name.value = kind + " " + label
	}
	trace.SpanFromContext(ctx).SetAttributes(
		attribute.String("graphql.operation.type", kind),
		attribute.String("graphql.operation.name", label),
	)

	return nil
}

func operationLabel(name string, operation *ast.OperationDefinition) string {
	if name != "" {
		return name
	}
	for _, selection := range operation.SelectionSet {
		if field, ok := selection.(*ast.Field); ok {
			return field.Name
		}
	}

	return anonymousOperation
}
