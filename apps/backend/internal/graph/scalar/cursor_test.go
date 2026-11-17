package scalar_test

import (
	"bytes"
	"errors"
	"testing"

	"entgo.io/contrib/entgql"
	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/scalar"
)

func TestCursorRoundTrips(t *testing.T) {
	made := entgql.Cursor[uuid.UUID]{
		ID: uuid.MustParse("bb563ad5-1ac4-46c2-a25f-6f62d245f44c"),
	}
	var written bytes.Buffer
	scalar.MarshalCursor(made).MarshalGQL(&written)

	read, err := scalar.UnmarshalCursor(unquote(written.String()))

	if err != nil || read.ID != made.ID {
		t.Errorf("read = %+v, err = %v, want %+v", read, err, made)
	}
}

func TestUnmarshalCursorRefusesWhatEntDidNotMake(t *testing.T) {
	for _, value := range []any{"not-base64!!", "bm90IGEgY3Vyc29y", 42} {
		_, err := scalar.UnmarshalCursor(value)

		var bad *apperr.Error
		if !errors.As(err, &bad) || bad.Code() != apperr.CodeInvalidCursor ||
			bad.Error() != scalar.InvalidCursorMessage {
			t.Errorf(
				"UnmarshalCursor(%v) err = %v, want an invalid cursor error %q",
				value,
				err,
				scalar.InvalidCursorMessage,
			)
		}
	}
}

func unquote(quoted string) string {
	return quoted[1 : len(quoted)-1]
}
