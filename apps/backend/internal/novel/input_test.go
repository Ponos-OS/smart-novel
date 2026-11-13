package novel_test

import (
	"errors"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"
)

func violations(t *testing.T, err error) []validation.Violation {
	t.Helper()
	var invalid *validation.Error
	if !errors.As(err, &invalid) {
		t.Fatalf("err = %v, want a validation error", err)
	}

	return invalid.Violations
}
