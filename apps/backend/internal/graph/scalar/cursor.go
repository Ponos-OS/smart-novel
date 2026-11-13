package scalar

import (
	"io"

	"entgo.io/contrib/entgql"
	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
)

// InvalidCursorMessage is the message answered for a pagination cursor ent did not make.
const InvalidCursorMessage = "Invalid cursor"

// MarshalCursor writes the cursor ent made for a page.
func MarshalCursor(cursor entgql.Cursor[uuid.UUID]) graphql.Marshaler {
	return graphql.WriterFunc(func(w io.Writer) { cursor.MarshalGQL(w) })
}

// UnmarshalCursor reads a cursor argument or variable; one that ent did not make is the caller's mistake (INVALID_CURSOR), not a server error.
func UnmarshalCursor(v any) (entgql.Cursor[uuid.UUID], error) {
	var cursor entgql.Cursor[uuid.UUID]
	if err := cursor.UnmarshalGQL(v); err != nil {
		return cursor, apperr.WithCode(apperr.CodeInvalidCursor, InvalidCursorMessage)
	}

	return cursor, nil
}
