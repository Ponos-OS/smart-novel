package schema

import (
	"os"
	"strconv"
	"testing"

	"entgo.io/ent"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

// maxLengthInSDL returns the @maxLength of a field of an input type in an api file.
func maxLengthInSDL(t *testing.T, path, typeName, fieldName string) int {
	t.Helper()

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	document, parseErr := parser.ParseSchema(&ast.Source{Name: path, Input: string(raw)})
	if parseErr != nil {
		t.Fatal(parseErr)
	}
	definition := document.Definitions.ForName(typeName)
	if definition == nil {
		t.Fatalf("%s has no type %s", path, typeName)
	}
	field := definition.Fields.ForName(fieldName)
	if field == nil {
		t.Fatalf("%s.%s is not in %s", typeName, fieldName, path)
	}
	value, err := strconv.Atoi(field.Directives.ForName("maxLength").Arguments.ForName("max").Value.Raw)
	if err != nil {
		t.Fatal(err)
	}

	return value
}

func entMaxLength(t *testing.T, fields []ent.Field, name string) int {
	t.Helper()

	for _, f := range fields {
		if f.Descriptor().Name == name {
			return f.Descriptor().Size
		}
	}
	t.Fatalf("the ent schema has no field %s", name)

	return 0
}

func TestTagLimitsMatchTheAPI(t *testing.T) {
	const path = "../../api/tag.graphql"
	cases := []struct {
		input string
		field string
	}{
		{"RequestTagInput", "name"},
		{"RequestTagInput", "description"},
		{"CreateTagInput", "name"},
		{"CreateTagInput", "description"},
		{"UpdateTagInput", "name"},
		{"UpdateTagInput", "description"},
	}
	for _, c := range cases {
		t.Run(c.input+"."+c.field, func(t *testing.T) {
			api := maxLengthInSDL(t, path, c.input, c.field)

			stored := entMaxLength(t, Tag{}.Fields(), c.field)

			if api != stored {
				t.Errorf("@maxLength is %d in %s but the ent field allows %d", api, path, stored)
			}
		})
	}
}
