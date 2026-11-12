package server

import (
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

func TestExceeds(t *testing.T) {
	const eightLevels = `{ a { b { c { d { e { f { g { h } } } } } } } }`
	const nineLevels = `{ a { b { c { d { e { f { g { h { i } } } } } } } } }`
	cases := []struct {
		name  string
		query string
		want  bool
	}{
		{"one field", `{ health }`, false},
		{"eight levels", eightLevels, false},
		{"nine levels", nineLevels, true},
		{"siblings are not added up", `{ a { b { c } } d { e { f } } }`, false},
		{"introspection is not counted", `{ __schema { types { fields { type { ofType { ofType { ofType { name } } } } } } } }`, false},
		{"inline fragment adds no level", `{ a { ... on A { b { c { d { e { f { g { h } } } } } } } } }`, false},
		{"fragment spread nests like the field", `query { a { ...F } } fragment F on A { b { c { d { e { f { g { h { i } } } } } } } }`, true},
		{"deep field next to a shallow one", `{ a { b } c { d { e { f { g { h { i { j { k } } } } } } } } }`, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			document, err := parser.ParseQuery(&ast.Source{Input: c.query})
			if err != nil {
				t.Fatal(err)
			}

			got := exceeds(document.Operations[0].SelectionSet, document.Fragments, 0, maxQueryDepth)

			if got != c.want {
				t.Errorf("exceeds = %v, want %v", got, c.want)
			}
		})
	}
}
