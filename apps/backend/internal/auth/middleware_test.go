package auth_test

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
)

type fakeVerifier struct {
	viewer auth.Viewer
	err    error
	tokens []string
}

func (f *fakeVerifier) Verify(_ context.Context, token string) (auth.Viewer, error) {
	f.tokens = append(f.tokens, token)

	return f.viewer, f.err
}

func TestMiddleware(t *testing.T) {
	writer := auth.Viewer{Subject: ownerID, Roles: []string{"writer"}}
	cases := []struct {
		name       string
		header     string
		verifier   *fakeVerifier
		wantTokens []string
		wantViewer bool
		wantError  string
	}{
		{"no header", "", &fakeVerifier{viewer: writer}, nil, false, "Missing Bearer token in Authorization header"},
		{"not a bearer token", "Basic dXNlcjpwYXNz", &fakeVerifier{viewer: writer}, nil, false, "Missing Bearer token in Authorization header"},
		{"empty bearer token", "Bearer  ", &fakeVerifier{viewer: writer}, nil, false, "Missing Bearer token in Authorization header"},
		{"valid token", "Bearer eyJhbGciOiJSUzI1NiJ9.e30.sig", &fakeVerifier{viewer: writer}, []string{"eyJhbGciOiJSUzI1NiJ9.e30.sig"}, true, ""},
		{"lowercase scheme", "bearer eyJhbGciOiJSUzI1NiJ9.e30.sig", &fakeVerifier{viewer: writer}, []string{"eyJhbGciOiJSUzI1NiJ9.e30.sig"}, true, ""},
		{"rejected token", "Bearer eyJhbGciOiJSUzI1NiJ9.e30.sig", &fakeVerifier{err: errors.New("token expired")}, []string{"eyJhbGciOiJSUzI1NiJ9.e30.sig"}, false, "Invalid or expired token"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var seen context.Context
			handler := auth.Middleware(c.verifier, slog.New(slog.DiscardHandler))(
				http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { seen = r.Context() }),
			)
			request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/graphql", nil)
			if c.header != "" {
				request.Header.Set("Authorization", c.header)
			}

			handler.ServeHTTP(httptest.NewRecorder(), request)

			_, hasViewer := auth.ViewerFrom(seen)
			_, err := auth.Require(seen)
			if hasViewer != c.wantViewer || len(c.verifier.tokens) != len(c.wantTokens) {
				t.Errorf("viewer = %v, verified %v, want viewer %v and tokens %v", hasViewer, c.verifier.tokens, c.wantViewer, c.wantTokens)
			}
			if (err == nil) != c.wantViewer || (err != nil && err.Error() != c.wantError) {
				t.Errorf("Require error = %v, want %q", err, c.wantError)
			}
		})
	}
}
