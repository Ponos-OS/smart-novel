package graph

import (
	"context"

	"github.com/99designs/gqlgen/graphql"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
)

// Directives are markers read by auth.Guard, so running one only continues the resolver chain.
func Directives() DirectiveRoot {
	return DirectiveRoot{
		Public: func(ctx context.Context, _ any, next graphql.Resolver) (any, error) {
			return next(ctx)
		},
		HasRole: func(ctx context.Context, _ any, next graphql.Resolver, _ model.Role) (any, error) {
			return next(ctx)
		},
	}
}
