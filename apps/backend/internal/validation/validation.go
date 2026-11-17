// Package validation is the boundary check of the GraphQL API: a resolver runs a Checker over an input before it calls a service,
// and the services trust what comes out. Types, required fields and IDs are already checked by the schema and its scalars.
package validation

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
)

// NULMessage is the bad request for a NUL character: PostgreSQL cannot store or compare it.
const NULMessage = "Text cannot contain a NUL character"

// Rules reported in a Violation.
const (
	RuleBlank    = "blank"
	RuleInvalid  = "invalid_format"
	RuleTooShort = "too_short"
	RuleTooLong  = "too_long"
	RuleTooSmall = "too_small"
	RuleTooLarge = "too_large"
)

// Violation says which input field broke which rule, with the numbers a client needs to word the message.
type Violation struct {
	Field  string         `json:"field"`
	Rule   string         `json:"rule"`
	Params map[string]any `json:"params,omitempty"`
}

// Error lists every rule an input broke. It is a bad request, and its violations travel in extensions.violations.
type Error struct {
	Violations []Violation
}

func (*Error) Error() string { return "Invalid input" }

func (*Error) Code() string { return apperr.CodeBadRequest }

func (e *Error) Extensions() map[string]any {
	return map[string]any{"violations": e.Violations}
}

// Checker collects the violations of one input, so a client sees all of them at once.
type Checker struct {
	violations []Violation
}

// NotBlank accepts a value that has something other than white space in it.
func (c *Checker) NotBlank(field, value string) {
	if strings.TrimSpace(value) == "" {
		c.add(field, RuleBlank, nil)
	}
}

// MinLength counts characters, not bytes.
func (c *Checker) MinLength(field, value string, minimum int) {
	if utf8.RuneCountInString(value) < minimum {
		c.add(field, RuleTooShort, map[string]any{"min": minimum})
	}
}

// MaxLength counts characters, not bytes.
func (c *Checker) MaxLength(field, value string, maximum int) {
	if utf8.RuneCountInString(value) > maximum {
		c.add(field, RuleTooLong, map[string]any{"max": maximum})
	}
}

// Matches accepts a value the whole pattern matches.
func (c *Checker) Matches(field, value string, pattern *regexp.Regexp) {
	if !pattern.MatchString(value) {
		c.add(field, RuleInvalid, nil)
	}
}

// AtLeast accepts a number that is not below minimum.
func (c *Checker) AtLeast(field string, value, minimum int) {
	if value < minimum {
		c.add(field, RuleTooSmall, map[string]any{"min": minimum})
	}
}

// AtMost accepts a number that is not above maximum.
func (c *Checker) AtMost(field string, value, maximum int) {
	if value > maximum {
		c.add(field, RuleTooLarge, map[string]any{"max": maximum})
	}
}

// Err is nil when nothing was violated.
func (c *Checker) Err() error {
	if len(c.violations) == 0 {
		return nil
	}

	return &Error{Violations: c.violations}
}

func (c *Checker) add(field, rule string, params map[string]any) {
	c.violations = append(
		c.violations,
		Violation{Field: field, Rule: rule, Params: params},
	)
}
