package scalar

import (
	"io"

	"entgo.io/contrib/entgql"
	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/shared"
)

// MarshalCursor writes the cursor ent made for a page.
func MarshalCursor(cursor entgql.Cursor[uuid.UUID]) graphql.Marshaler {
	return graphql.WriterFunc(func(w io.Writer) { cursor.MarshalGQL(w) })
}

// UnmarshalCursor reads a cursor argument or variable; one that ent did not make is a bad request, not a server error.
func UnmarshalCursor(v any) (entgql.Cursor[uuid.UUID], error) {
	var cursor entgql.Cursor[uuid.UUID]
	if err := cursor.UnmarshalGQL(v); err != nil {
		return cursor, apperr.BadRequest(shared.InvalidCursorMessage)
	}

	return cursor, nil
}
