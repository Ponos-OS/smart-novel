// Package apperr holds the errors a domain package returns for a client to see: a code for extensions.code and a message.
package apperr

// The codes the backend answers in extensions.code. The frontend branches on the ones that name a domain error (see src/lib/api-error-codes.ts).
const (
	CodeUnauthenticated = "UNAUTHENTICATED"
	CodeForbidden       = "FORBIDDEN"
	CodeNotFound        = "NOT_FOUND"
	CodeConflict        = "CONFLICT"
	CodeBadRequest      = "BAD_REQUEST"

	CodeInvalidCursor                = "INVALID_CURSOR"
	CodePlatformTermsNotAccepted     = "PLATFORM_TERMS_NOT_ACCEPTED"
	CodePlatformTermsVersionMismatch = "PLATFORM_TERMS_VERSION_MISMATCH"
)

// Error is an error whose message a client may read.
type Error struct {
	code    string
	message string
}

func (e *Error) Error() string { return e.message }

func (e *Error) Code() string { return e.code }

// BadRequest is for input that is well formed but cannot be accepted.
func BadRequest(message string) error {
	return &Error{code: CodeBadRequest, message: message}
}

// NotFound is for something the caller asked for by ID that does not exist.
func NotFound(message string) error {
	return &Error{code: CodeNotFound, message: message}
}

// Conflict is for an edit based on a version that is no longer the current one.
func Conflict(message string) error {
	return &Error{code: CodeConflict, message: message}
}

// WithCode is for an error that has a code of its own for the client to act on.
func WithCode(code, message string) error {
	return &Error{code: code, message: message}
}
