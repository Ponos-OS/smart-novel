// Package apperr holds the errors a domain package returns for a client to see: a code for extensions.code and a message.
package apperr

import "github.com/Ponos-OS/smart-novel/apps/backend/internal/shared"

// Error is an error whose message a client may read.
type Error struct {
	code    string
	message string
}

func (e *Error) Error() string { return e.message }

func (e *Error) Code() string { return e.code }

// BadRequest is for input that is well formed but cannot be accepted.
func BadRequest(message string) error {
	return &Error{code: shared.BadRequest, message: message}
}

// NotFound is for something the caller asked for by ID that does not exist.
func NotFound(message string) error {
	return &Error{code: shared.NotFound, message: message}
}

// Conflict is for an edit based on a version that is no longer the current one.
func Conflict(message string) error {
	return &Error{code: shared.Conflict, message: message}
}
