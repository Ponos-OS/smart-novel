package server

import (
	"context"
	"fmt"
	"strings"

	"github.com/99designs/gqlgen/graphql"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

// maxQueryDepth is how many field levels deep an operation may nest.
// A field with no selection set does not add a level, and introspection fields are not counted.
const maxQueryDepth = 7

// depthLimit rejects operations that nest deeper than limit, before any resolver runs.
type depthLimit struct{ limit int }

var (
	_ graphql.HandlerExtension        = depthLimit{}
	_ graphql.OperationContextMutator = depthLimit{}
)

func (depthLimit) ExtensionName() string { return "DepthLimit" }

func (depthLimit) Validate(graphql.ExecutableSchema) error { return nil }

func (d depthLimit) MutateOperationContext(_ context.Context, operation *graphql.OperationContext) *gqlerror.Error {
	if exceeds(operation.Operation.SelectionSet, operation.Doc.Fragments, 0, d.limit) {
		name := operation.Operation.Name
		if name == "" {
			name = "operation"
		}

		return &gqlerror.Error{
			Message:    fmt.Sprintf("'%s' exceeds maximum operation depth of %d", name, d.limit),
			Extensions: map[string]any{extensionCode: codeValidation},
		}
	}

	return nil
}

// exceeds reports whether any field in selections sits deeper than limit, where the fields of the operation are at depth 0.
func exceeds(selections ast.SelectionSet, fragments ast.FragmentDefinitionList, depth, limit int) bool {
	for _, selection := range selections {
		if selectionExceeds(selection, fragments, depth, limit) {
			return true
		}
	}

	return false
}

func selectionExceeds(selection ast.Selection, fragments ast.FragmentDefinitionList, depth, limit int) bool {
	switch node := selection.(type) {
	case *ast.Field:
		if strings.HasPrefix(node.Name, "__") || len(node.SelectionSet) == 0 {
			return false
		}

		return depth+1 > limit || exceeds(node.SelectionSet, fragments, depth+1, limit)
	case *ast.InlineFragment:
		return exceeds(node.SelectionSet, fragments, depth, limit)
	case *ast.FragmentSpread:
		definition := fragments.ForName(node.Name)

		return definition != nil && exceeds(definition.SelectionSet, fragments, depth, limit)
	}

	return false
}
