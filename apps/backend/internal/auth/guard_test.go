package auth_test

import (
	"context"
	"errors"
	"testing"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
)

type guardCase struct {
	name       string
	object     string
	field      string
	directives []*ast.Directive
	viewer     *auth.Viewer
}

func (c guardCase) context() context.Context {
	field := &ast.Field{Name: c.field, Definition: &ast.FieldDefinition{Name: c.field, Directives: c.directives}}
	ctx := graphql.WithFieldContext(context.Background(), &graphql.FieldContext{Object: c.object, Field: graphql.CollectedField{Field: field}})
	if c.viewer != nil {
		ctx = auth.WithViewer(ctx, *c.viewer)
	}

	return ctx
}

func public() *ast.Directive { return &ast.Directive{Name: "public"} }

func hasRole(role string) *ast.Directive {
	return &ast.Directive{
		Name:      "hasRole",
		Arguments: ast.ArgumentList{{Name: "role", Value: &ast.Value{Raw: role}}},
	}
}

type codedError interface {
	error
	Code() string
}

func TestGuardLetsTheResolverRun(t *testing.T) {
	writer := &auth.Viewer{Subject: ownerID, Roles: []string{"writer"}}
	cases := []guardCase{
		{"public field without a token", "Query", "health", []*ast.Directive{public()}, nil},
		{"unmarked root field with a viewer", "Query", "whoAmI", nil, writer},
		{"role field with the role", "Mutation", "createTag", []*ast.Directive{hasRole("writer")}, writer},
		{"field below the root", "Novel", "writer", nil, nil},
		{"introspection field", "Query", "__schema", nil, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			next := func(context.Context) (any, error) { return "resolved", nil }

			result, err := auth.Guard()(c.context(), next)

			if err != nil || result != "resolved" {
				t.Errorf("result = %v, err = %v, want the resolver to run", result, err)
			}
		})
	}
}

func TestGuardRefusesBeforeTheResolverRuns(t *testing.T) {
	writer := &auth.Viewer{Subject: ownerID, Roles: []string{"writer"}}
	cases := []struct {
		guardCase
		wantCode string
		wantText string
	}{
		{guardCase{"unmarked root field without a token", "Query", "whoAmI", nil, nil}, "UNAUTHENTICATED", "Missing Bearer token in Authorization header"},
		{guardCase{"role field without a token", "Mutation", "deleteTag", []*ast.Directive{hasRole("admin")}, nil}, "UNAUTHENTICATED", "Missing Bearer token in Authorization header"},
		{guardCase{"role field with a lower role", "Mutation", "deleteTag", []*ast.Directive{hasRole("admin")}, writer}, "FORBIDDEN", `You need at least the "admin" role to perform this action`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ran := false
			next := func(context.Context) (any, error) { ran = true; return "resolved", nil }

			_, err := auth.Guard()(c.context(), next)

			var coded codedError
			if !errors.As(err, &coded) || coded.Code() != c.wantCode || coded.Error() != c.wantText {
				t.Errorf("err = %v, want %s %q", err, c.wantCode, c.wantText)
			}
			if ran {
				t.Error("the resolver ran")
			}
		})
	}
}
