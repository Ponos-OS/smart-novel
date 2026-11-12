package scalar_test

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/scalar"
)

func TestUnmarshalUUID(t *testing.T) {
	cases := []struct {
		name    string
		input   any
		want    uuid.UUID
		wantErr bool
	}{
		{"a UUID", "f47ac10b-58cc-4372-a567-0e02b2c3d479", uuid.MustParse("f47ac10b-58cc-4372-a567-0e02b2c3d479"), false},
		{"not a UUID", "x", uuid.Nil, true},
		{"empty", "", uuid.Nil, true},
		{"a number", 42, uuid.Nil, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := scalar.UnmarshalUUID(c.input)

			var invalid scalar.InvalidIDError
			if c.wantErr != errors.As(err, &invalid) || got != c.want {
				t.Errorf("got %v, %v; want %v, invalid ID error %v", got, err, c.want, c.wantErr)
			}
		})
	}
}

func TestInvalidIDErrorIsABadRequest(t *testing.T) {
	err := scalar.InvalidIDError{}

	if err.Error() != "Invalid ID" || err.Code() != "BAD_REQUEST" {
		t.Errorf("got %q with code %q", err.Error(), err.Code())
	}
}
