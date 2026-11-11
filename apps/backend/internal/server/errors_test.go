package server

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/ast"
)

type penNameTakenError struct{}

func (penNameTakenError) Error() string { return "That pen name is taken" }
func (penNameTakenError) Code() string  { return "PEN_NAME_TAKEN" }

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
		{"client error keeps its message and code", penNameTakenError{}, "That pen name is taken", "PEN_NAME_TAKEN"},
		{"unexpected error is hidden", errors.New(`pq: relation "writer" does not exist`), "Internal server error", "INTERNAL_SERVER_ERROR"},
		{"introspection is refused, not reported as a failure", errors.New("introspection disabled"), "introspection disabled", "GRAPHQL_VALIDATION_FAILED"},
		{"wrapped client error is still recognised", errors.Join(errors.New("context"), penNameTakenError{}), "That pen name is taken", "PEN_NAME_TAKEN"},
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
