package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"unicode"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

// skipped is the schema ent generates; it is not hand-written and carries no limits.
const skipped = "ent.graphql"

// rules maps a directive to the argument that holds its limit and the suffix of the constant.
var rules = []struct {
	directive string
	argument  string
	suffix    string
}{
	{"maxLength", "max", "MAX_LENGTH"},
	{"minLength", "min", "MIN_LENGTH"},
	{"maxSize", "max", "MAX_SIZE"},
}

var operationTypes = []string{"Query", "Mutation", "Subscription"}

// Limit is one constant: a rule of the schema on a field or an argument.
type Limit struct {
	Name  string
	Value int
}

// readLimits reads every hand-written *.graphql file of dir and returns the limits sorted by name. For a file with
//
//	input RequestNoteInput { text: String! @maxLength(max: 1000) }
//
// It returns []Limit{{Name: "REQUEST_NOTE_INPUT_TEXT_MAX_LENGTH", Value: 1000}}.
func readLimits(dir string) ([]Limit, error) {
	paths, err := filepath.Glob(
		filepath.Join(dir, "*.graphql"), // apps/backend/api/*.graphql
	)
	if err != nil {
		return nil, err
	}

	var limits []Limit
	for _, path := range paths {
		if filepath.Base(path) == skipped {
			continue
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		document, parseErr := parser.ParseSchema(&ast.Source{Name: path, Input: string(raw)})
		if parseErr != nil {
			return nil, parseErr
		}
		found, err := limitsOf(append(document.Definitions, document.Extensions...), path)
		if err != nil {
			return nil, err
		}
		limits = append(limits, found...)
	}

	return unique(limits)
}

// limitsOf collects the limits of every field of the definitions, in the order they are written. For the definition
//
//	extend type Mutation { markNotesRead(noteIDs: [ID!]! @maxSize(max: 100)): Int! }
//
// It returns []Limit{{Name: "MARK_NOTES_READ_NOTE_IDS_MAX_SIZE", Value: 100}}.
func limitsOf(definitions ast.DefinitionList, path string) ([]Limit, error) {
	var limits []Limit
	for _, definition := range definitions {
		for _, field := range definition.Fields {
			found, err := limitsOfField(definition, field, path)
			if err != nil {
				return nil, err
			}
			limits = append(limits, found...)
		}
	}

	return limits, nil
}

// limitsOfField collects the limits on a field and on its arguments.
//
// For the field penName of RequestNoteInput: penName: String! @minLength(min: 3) @maxLength(max: 50)
//
// It returns
//
//	[]Limit{
//		{Name: "REQUEST_NOTE_INPUT_PEN_NAME_MAX_LENGTH", Value: 50},
//		{Name: "REQUEST_NOTE_INPUT_PEN_NAME_MIN_LENGTH", Value: 3},
//	}
func limitsOfField(definition *ast.Definition, field *ast.FieldDefinition, path string) ([]Limit, error) {
	limits, err := limitsOfDirectives(field.Directives, nameOf(definition, field.Name, ""), path)
	if err != nil {
		return nil, err
	}
	for _, argument := range field.Arguments {
		found, err := limitsOfDirectives(argument.Directives, nameOf(definition, field.Name, argument.Name), path)
		if err != nil {
			return nil, err
		}
		limits = append(limits, found...)
	}

	return limits, nil
}

// limitsOfDirectives turns the limit directives among directives into constants named base plus the suffix of the rule.
//
// For @maxLength(max: 50) with base: "REQUEST_NOTE_INPUT_TEXT"
//
// It returns []Limit{{Name: "REQUEST_NOTE_INPUT_TEXT_MAX_LENGTH", Value: 50}}
func limitsOfDirectives(directives ast.DirectiveList, base, path string) ([]Limit, error) {
	var limits []Limit
	for _, rule := range rules {
		directive := directives.ForName(rule.directive)
		if directive == nil {
			continue
		}
		argument := directive.Arguments.ForName(rule.argument)
		if argument == nil || argument.Value == nil || argument.Value.Kind != ast.IntValue {
			return nil, fmt.Errorf("%w: @%s on %s in %s", errNotAnInteger, rule.directive, base, path)
		}
		value, err := strconv.Atoi(argument.Value.Raw)
		if err != nil {
			return nil, fmt.Errorf("%w: @%s on %s in %s", errNotAnInteger, rule.directive, base, path)
		}
		limits = append(limits, Limit{Name: base + "_" + rule.suffix, Value: value})
	}

	return limits, nil
}

var (
	errNotAnInteger = errors.New("the limit must be an integer literal")
	errDuplicate    = errors.New("two rules give the same constant")
)

// nameOf builds the constant name from where the rule sits: the operation or the input type, the field, the argument.
// The field `text` of RequestNoteInput gives REQUEST_NOTE_INPUT_TEXT, and the argument `noteIDs` of the mutation
// `markNotesRead` gives MARK_NOTES_READ_NOTE_IDS (a root operation type's own name is left out).
func nameOf(definition *ast.Definition, field, argument string) string {
	parts := []string{}
	if !slices.Contains(operationTypes, definition.Name) {
		parts = append(parts, definition.Name)
	}
	parts = append(parts, field)
	if argument != "" {
		parts = append(parts, argument)
	}
	for index, part := range parts {
		parts[index] = screamingSnake(part)
	}

	return strings.Join(parts, "_")
}

// screamingSnake splits at a lower case letter followed by an upper case one, so chapterIDs is CHAPTER_IDS and novelID is NOVEL_ID.
// penName gives PEN_NAME and CreateTagInput gives CREATE_TAG_INPUT.
func screamingSnake(name string) string {
	var builder strings.Builder
	runes := []rune(name)
	for index, r := range runes {
		if index > 0 && unicode.IsUpper(r) && unicode.IsLower(runes[index-1]) {
			builder.WriteByte('_')
		}
		builder.WriteRune(unicode.ToUpper(r))
	}

	return builder.String()
}

// unique sorts the limits by name and refuses two with the same name. Given
//
//	[]Limit{{Name: "B_MAX_LENGTH", Value: 5}, {Name: "A_MAX_LENGTH", Value: 7}}
//
// It returns []Limit{{Name: "A_MAX_LENGTH", Value: 7}, {Name: "B_MAX_LENGTH", Value: 5}}
func unique(limits []Limit) ([]Limit, error) {
	seen := map[string]int{}
	for _, limit := range limits {
		if _, found := seen[limit.Name]; found {
			return nil, fmt.Errorf("%w: %s", errDuplicate, limit.Name)
		}
		seen[limit.Name] = limit.Value
	}
	slices.SortFunc(limits, func(a, b Limit) int { return strings.Compare(a.Name, b.Name) })

	return limits, nil
}

// render writes the TypeScript file. Given []Limit{{Name: "PEN_NAME_MAX_LENGTH", Value: 50}} it returns
//
//	// Code generated by tools/gensdl from apps/backend/api/*.graphql. DO NOT EDIT.
//
//	export const PEN_NAME_MAX_LENGTH = 50;
func render(limits []Limit) string {
	var builder strings.Builder
	builder.WriteString("// Code generated by tools/gensdl from apps/backend/api/*.graphql. DO NOT EDIT.\n")
	for _, limit := range limits {
		fmt.Fprintf(&builder, "\nexport const %s = %d;\n", limit.Name, limit.Value)
	}

	return builder.String()
}
