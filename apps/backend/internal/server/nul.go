package server

import (
	"context"
	"strings"

	"github.com/99designs/gqlgen/graphql"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"
)

// rejectNUL refuses an argument that holds a NUL character anywhere, in a variable or a literal, as the client sent it: PostgreSQL cannot store or compare it,
// so it would otherwise reach the database and come back as a server error.
func rejectNUL(ctx context.Context, next graphql.Resolver) (any, error) {
	if field := graphql.GetFieldContext(ctx); field != nil && hasNUL(rawArguments(ctx, field)) {
		return nil, apperr.BadRequest(validation.NULMessage)
	}

	return next(ctx)
}

// rawArguments are the arguments as the client sent them. The ones gqlgen already read are typed Go values (a where input is a struct),
// which hasNUL cannot walk.
func rawArguments(ctx context.Context, field *graphql.FieldContext) map[string]any {
	return field.Field.ArgumentMap(graphql.GetOperationContext(ctx).Variables)
}

func hasNUL(value any) bool {
	switch typed := value.(type) {
	case string:
		return strings.ContainsRune(typed, 0)
	case []any:
		for _, item := range typed {
			if hasNUL(item) {
				return true
			}
		}
	case map[string]any:
		for key, item := range typed {
			if strings.ContainsRune(key, 0) || hasNUL(item) {
				return true
			}
		}
	}

	return false
}
