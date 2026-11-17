package auth

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
)

const logKeyError = "error"

// Verifier turns an access token into the viewer it was issued for.
type Verifier interface {
	Verify(ctx context.Context, accessToken string) (Viewer, error)
}

// Middleware verifies the bearer token of a request, when it has one, and stores the outcome in the context.
// It never rejects: a GraphQL endpoint serves public and protected operations, so Guard decides per operation.
func Middleware(
	verifier Verifier,
	logger *slog.Logger,
) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := bearerToken(r)
			if !ok {
				next.ServeHTTP(w, r)

				return
			}
			viewer, err := verifier.Verify(r.Context(), token)
			if err != nil {
				logger.WarnContext(
					r.Context(),
					"token rejected",
					slog.String(logKeyError, err.Error()),
				)
				next.ServeHTTP(
					w,
					r.WithContext(withRejectedToken(r.Context(), err)),
				)

				return
			}
			next.ServeHTTP(
				w,
				r.WithContext(withViewer(r.Context(), viewer, token)),
			)
		})
	}
}

// bearerToken returns the token itself without the Bearer prefix
func bearerToken(r *http.Request) (string, bool) {
	scheme, token, found := strings.Cut(r.Header.Get("Authorization"), " ")
	if !found || !strings.EqualFold(scheme, "Bearer") ||
		strings.TrimSpace(token) == "" {
		return "", false
	}

	return strings.TrimSpace(token), true
}
