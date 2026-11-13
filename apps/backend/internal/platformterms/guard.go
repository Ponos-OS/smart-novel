package platformterms

import (
	"context"

	"github.com/99designs/gqlgen/graphql"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
)

const (
	mutationType       = "Mutation"
	skipTermsDirective = "skipTermsOfServiceCheck"
)

// Acceptances tells whether a user accepted the current terms.
type Acceptances interface {
	HasAcceptedCurrent(ctx context.Context, userID string) (bool, error)
}

// Guard blocks a writer (or an admin) who has not accepted the current terms from a mutation, unless it is marked @skipTermsOfServiceCheck. It runs after
// auth.Guard, so the caller is already authenticated and has the role; a user who is not a writer passes, because the role gate refuses
// them where it matters.
func Guard(service Acceptances) graphql.FieldMiddleware {
	return func(ctx context.Context, next graphql.Resolver) (any, error) {
		field := graphql.GetFieldContext(ctx)
		if field == nil || field.Object != mutationType || field.Field.Definition == nil || field.Field.Definition.Directives.ForName(skipTermsDirective) != nil {
			return next(ctx)
		}
		viewer, ok := auth.ViewerFrom(ctx)
		if !ok || !viewer.HasMinimumRole(auth.RoleWriter) {
			return next(ctx)
		}
		accepted, err := service.HasAcceptedCurrent(ctx, viewer.Subject)
		if err != nil {
			return nil, err
		}
		if !accepted {
			return nil, NotAccepted()
		}

		return next(ctx)
	}
}
