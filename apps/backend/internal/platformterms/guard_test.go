package platformterms_test

import (
	"context"
	"errors"
	"testing"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platformterms"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/shared"
)

type acceptances struct {
	accepted bool
	err      error
	asked    int
}

func (a *acceptances) HasAcceptedCurrent(context.Context, string) (bool, error) {
	a.asked++

	return a.accepted, a.err
}

func fieldWith(object string, directives ...string) context.Context {
	definition := &ast.FieldDefinition{Name: "createNovel"}
	for _, name := range directives {
		definition.Directives = append(definition.Directives, &ast.Directive{Name: name})
	}
	field := &graphql.FieldContext{Object: object, Field: graphql.CollectedField{Field: &ast.Field{Name: "createNovel", Definition: definition}}}

	return graphql.WithFieldContext(context.Background(), field)
}

func TestGuard(t *testing.T) {
	writer := auth.Viewer{Subject: "399193312025837589", Roles: []string{string(shared.RoleWriter)}}
	admin := auth.Viewer{Subject: "399193312025837590", Roles: []string{string(shared.RoleAdmin)}}
	reader := auth.Viewer{Subject: "399193312025837591", Roles: []string{string(shared.RoleUser)}}
	cases := []struct {
		name       string
		object     string
		directives []string
		viewer     *auth.Viewer
		accepted   bool
		blocked    bool
		asked      int
	}{
		{"a writer who accepted", "Mutation", nil, &writer, true, false, 1},
		{"a writer who did not", "Mutation", nil, &writer, false, true, 1},
		{"an admin who did not", "Mutation", nil, &admin, false, true, 1},
		{"a mutation that skips the check", "Mutation", []string{"skipTermsOfServiceCheck"}, &writer, false, false, 0},
		{"a reader is not asked", "Mutation", nil, &reader, false, false, 0},
		{"an anonymous caller is left to the role gate", "Mutation", nil, nil, false, false, 0},
		{"a query is never gated", "Query", nil, &writer, false, false, 0},
		{"a field of a mutation result is never gated", "Novel", nil, &writer, false, false, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			checker := &acceptances{accepted: c.accepted}
			ctx := fieldWith(c.object, c.directives...)
			if c.viewer != nil {
				ctx = auth.WithViewer(ctx, *c.viewer)
			}

			_, err := platformterms.Guard(checker)(ctx, func(context.Context) (any, error) { return "done", nil })

			if c.blocked {
				assertNotAccepted(t, err)
			} else if err != nil {
				t.Errorf("err = %v, want it to pass", err)
			}
			if checker.asked != c.asked {
				t.Errorf("asked %d times, want %d", checker.asked, c.asked)
			}
		})
	}
}

func assertNotAccepted(t *testing.T, err error) {
	t.Helper()
	var coded interface{ Code() string }
	if !errors.As(err, &coded) || coded.Code() != shared.PlatformTermsNotAccepted {
		t.Errorf("err = %v, want %s", err, shared.PlatformTermsNotAccepted)
	}
}

func TestGuardPassesOnADatabaseFailureAsAnError(t *testing.T) {
	failure := errors.New("connection refused")
	ctx := auth.WithViewer(fieldWith("Mutation"), auth.Viewer{Subject: "399193312025837589", Roles: []string{string(shared.RoleWriter)}})

	_, err := platformterms.Guard(&acceptances{err: failure})(ctx, func(context.Context) (any, error) { return nil, nil })

	if !errors.Is(err, failure) {
		t.Errorf("err = %v, want the failure", err)
	}
}
