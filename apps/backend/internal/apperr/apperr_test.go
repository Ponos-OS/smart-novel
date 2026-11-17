package apperr_test

import (
	"errors"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
)

func TestErrors(t *testing.T) {
	cases := []struct {
		name     string
		err      error
		wantCode string
	}{
		{
			"bad request",
			apperr.BadRequest("Provide a name"),
			apperr.CodeBadRequest,
		},
		{"not found", apperr.NotFound("Tag not found"), apperr.CodeNotFound},
		{"conflict", apperr.Conflict("Reload"), apperr.CodeConflict},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var got *apperr.Error

			ok := errors.As(c.err, &got)

			if !ok || got.Code() != c.wantCode {
				t.Errorf("code = %v, want %s", got, c.wantCode)
			}
		})
	}
}
