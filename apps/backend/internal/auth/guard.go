package auth

import (
	"context"
	"strings"

	"github.com/99designs/gqlgen/graphql"
)

const (
	publicDirective  = "public"
	hasRoleDirective = "hasRole"
	roleArgument     = "role"
)

// Guard protects every root field (query, mutation, subscription) by default: it needs an authenticated viewer unless the field is
// marked @public, and @hasRole(role: ...) additionally needs that role or a higher one. Fields below the root are not guarded.
// The directives themselves are markers; this is the one place that enforces them.
func Guard() graphql.FieldMiddleware {
	return func(ctx context.Context, next graphql.Resolver) (any, error) {
		field := graphql.GetFieldContext(ctx)
		if field == nil || !isRootObject(field.Object) || strings.HasPrefix(field.Field.Name, "__") {
			return next(ctx)
		}
		directives := field.Field.Definition.Directives
		if directives.ForName(publicDirective) != nil {
			return next(ctx)
		}
		if marker := directives.ForName(hasRoleDirective); marker != nil {
			if _, err := RequireRole(ctx, Role(marker.Arguments.ForName(roleArgument).Value.Raw)); err != nil {
				return nil, err
			}

			return next(ctx)
		}
		if _, err := Require(ctx); err != nil {
			return nil, err
		}

		return next(ctx)
	}
}

func isRootObject(name string) bool {
	return name == "Query" || name == "Mutation" || name == "Subscription"
}
