package validation_test

import (
	"errors"
	"reflect"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/shared"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/validation"
)

func TestCheckerReportsEveryViolation(t *testing.T) {
	var checker validation.Checker

	checker.NotBlank("note", "   ")
	checker.MaxLength("description", "Ela escreve de manhã cedo.", 10)
	checker.MinLength("penName", "Ad", 3)
	checker.MaxLength("name", "The Salt Road", 200)
	err := checker.Err()

	var invalid *validation.Error
	if !errors.As(err, &invalid) {
		t.Fatalf("err = %v, want a validation error", err)
	}
	want := []validation.Violation{
		{Field: "note", Rule: validation.RuleBlank},
		{Field: "description", Rule: validation.RuleTooLong, Params: map[string]any{"max": 10}},
		{Field: "penName", Rule: validation.RuleTooShort, Params: map[string]any{"min": 3}},
	}
	if !reflect.DeepEqual(invalid.Violations, want) {
		t.Errorf("violations = %+v, want %+v", invalid.Violations, want)
	}
}

func TestCheckerCountsCharactersNotBytes(t *testing.T) {
	var checker validation.Checker

	checker.MaxLength("name", "Árvore de Natal", 15)
	checker.MinLength("name", "日本語", 3)

	if err := checker.Err(); err != nil {
		t.Errorf("err = %v, want none", err)
	}
}

func TestCheckerWithNothingWrongHasNoError(t *testing.T) {
	var checker validation.Checker

	if err := checker.Err(); err != nil {
		t.Errorf("err = %v, want nil", err)
	}
}

func TestErrorIsABadRequestWithItsViolations(t *testing.T) {
	err := &validation.Error{Violations: []validation.Violation{{Field: "note", Rule: validation.RuleBlank}}}

	if err.Code() != shared.BadRequest || err.Error() != "Invalid input" {
		t.Errorf("code = %q, message = %q", err.Code(), err.Error())
	}
	if got := err.Extensions()["violations"]; !reflect.DeepEqual(got, err.Violations) {
		t.Errorf("extensions = %v", err.Extensions())
	}
}
