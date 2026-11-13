package server

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/ast"
)

type licenseRetiredError struct{}

func (licenseRetiredError) Error() string { return "That license is retired" }
func (licenseRetiredError) Code() string  { return "CANONICAL_LICENSE_RETIRED" }

type invalidInputError struct{}

func (invalidInputError) Error() string { return "Invalid input" }
func (invalidInputError) Code() string  { return "BAD_REQUEST" }
func (invalidInputError) Extensions() map[string]any {
	return map[string]any{"violations": []string{"note"}}
}

func TestErrorPresenterAddsTheExtensionsOfAClientError(t *testing.T) {
	present := errorPresenter(slog.New(slog.DiscardHandler))
	ctx := graphql.WithPathContext(context.Background(), graphql.NewPathWithField("requestWriterAccess"))

	result := present(ctx, invalidInputError{})

	if result.Extensions["code"] != "BAD_REQUEST" || result.Extensions["violations"] == nil {
		t.Errorf("extensions = %v", result.Extensions)
	}
}

func TestErrorPresenter(t *testing.T) {
	logger := slog.New(slog.DiscardHandler)
	path := ast.Path{ast.PathName("requestWriterAccess")}
	ctx := graphql.WithPathContext(context.Background(), graphql.NewPathWithField("requestWriterAccess"))
	cases := []struct {
		name        string
		err         error
		wantMessage string
		wantCode    any
	}{
		{"client error keeps its message and code", licenseRetiredError{}, "That license is retired", "CANONICAL_LICENSE_RETIRED"},
		{"unexpected error is hidden", errors.New(`pq: relation "writer" does not exist`), "Internal server error", "INTERNAL_SERVER_ERROR"},
		{"introspection is refused, not reported as a failure", errors.New("introspection disabled"), "introspection disabled", "GRAPHQL_VALIDATION_FAILED"},
		{"wrapped client error is still recognised", errors.Join(errors.New("context"), licenseRetiredError{}), "That license is retired", "CANONICAL_LICENSE_RETIRED"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			present := errorPresenter(logger)

			result := present(ctx, c.err)

			if result.Message != c.wantMessage || result.Extensions["code"] != c.wantCode {
				t.Errorf("got %q %v, want %q %v", result.Message, result.Extensions, c.wantMessage, c.wantCode)
			}
			if result.Path.String() != path.String() {
				t.Errorf("path = %v, want %v", result.Path, path)
			}
		})
	}
}
