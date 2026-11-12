// Package scalar holds the marshallers gqlgen uses for the GraphQL scalars that need more than its defaults.
package scalar

import (
	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/shared"
)

// InvalidIDError is what a client gets for an ID argument that is not a UUID: a bad request, not a server error.
type InvalidIDError struct{}

func (InvalidIDError) Error() string { return "Invalid ID" }

func (InvalidIDError) Code() string { return shared.BadRequest }

// MarshalUUID writes an ID, and null for the zero UUID.
func MarshalUUID(id uuid.UUID) graphql.Marshaler {
	return graphql.MarshalUUID(id)
}

// UnmarshalUUID reads an ID argument or variable.
func UnmarshalUUID(v any) (uuid.UUID, error) {
	id, err := graphql.UnmarshalUUID(v)
	if err != nil {
		return uuid.Nil, InvalidIDError{}
	}

	return id, nil
}
