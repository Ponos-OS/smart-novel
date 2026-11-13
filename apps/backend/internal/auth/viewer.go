package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
)

// Viewer is the authenticated user a request acts for.
type Viewer struct {
	Subject           string
	Name              string
	PreferredUsername string
	Email             string
	EmailVerified     bool
	OrgID             string
	Roles             []string
}

type sessionKey struct{}

// session is what the HTTP middleware learned from the Authorization header.
type session struct {
	viewer *Viewer
	// tokenErr is set when a token was sent but could not be verified.
	tokenErr error
}

func withViewer(ctx context.Context, viewer Viewer) context.Context {
	return context.WithValue(ctx, sessionKey{}, &session{viewer: &viewer})
}

func withRejectedToken(ctx context.Context, err error) context.Context {
	return context.WithValue(ctx, sessionKey{}, &session{tokenErr: err})
}

// WithViewer returns a context that carries viewer, for tests and for code that acts on behalf of a user.
func WithViewer(ctx context.Context, viewer Viewer) context.Context {
	return withViewer(ctx, viewer)
}

// IsAdmin tells whether the request is by an authenticated admin; an anonymous request is not.
func IsAdmin(ctx context.Context) bool {
	viewer, ok := ViewerFrom(ctx)

	return ok && viewer.IsAdmin()
}

// ViewerFrom returns the authenticated viewer, if the request has one.
func ViewerFrom(ctx context.Context) (Viewer, bool) {
	current, ok := ctx.Value(sessionKey{}).(*session)
	if !ok || current.viewer == nil {
		return Viewer{}, false
	}

	return *current.viewer, true
}

// Require returns the viewer, or the error to answer an unauthenticated request with.
func Require(ctx context.Context) (Viewer, error) {
	if viewer, ok := ViewerFrom(ctx); ok {
		return viewer, nil
	}
	if current, ok := ctx.Value(sessionKey{}).(*session); ok && current.tokenErr != nil {
		return Viewer{}, errInvalidToken
	}

	return Viewer{}, errMissingToken
}

// RequireRole returns the viewer when their highest role is at least minimum.
func RequireRole(ctx context.Context, minimum Role) (Viewer, error) {
	viewer, err := Require(ctx)
	if err != nil {
		return Viewer{}, err
	}
	if !viewer.HasMinimumRole(minimum) {
		return Viewer{}, &Error{
			code:    apperr.CodeForbidden,
			message: fmt.Sprintf("You need at least the %q role to perform this action", minimum),
		}
	}

	return viewer, nil
}

// Error is an authentication or authorization failure a client may see.
type Error struct {
	code    string
	message string
}

func (e *Error) Error() string { return e.message }

func (e *Error) Code() string { return e.code }

var (
	errMissingToken = &Error{code: apperr.CodeUnauthenticated, message: "Missing Bearer token in Authorization header"}
	errInvalidToken = &Error{code: apperr.CodeUnauthenticated, message: "Invalid or expired token"}
	// ErrForbidden is what the authorization functions' callers return when a check fails.
	ErrForbidden = &Error{code: apperr.CodeForbidden, message: "You do not have permission to do this"}
)

// IsAuthError reports whether err is one of this package's errors.
func IsAuthError(err error) bool {
	var authErr *Error

	return errors.As(err, &authErr)
}
