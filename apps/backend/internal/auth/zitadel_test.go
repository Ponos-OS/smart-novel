package auth_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
)

const (
	issuer       = "http://auth.localhost:8080"
	clientID     = "399193312042418199"
	clientSecret = "4Jt0l3Ww9yq1a7mXf2Nn"
	writerToken  = "eyJhbGciOiJSUzI1NiJ9.e30.writer-signature"
)

// fakeZitadel answers like the instance behind the issuer: discovery, and introspection that needs the API application's credentials.
func respond(w http.ResponseWriter, body any) {
	if err := json.NewEncoder(w).Encode(body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

type fakeZitadel struct {
	*httptest.Server
	introspections atomic.Int32
	hosts          []string
}

func newFakeZitadel(t *testing.T) *fakeZitadel {
	t.Helper()
	fake := &fakeZitadel{}
	mux := http.NewServeMux()
	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		fake.hosts = append(fake.hosts, r.Host)
		respond(w, map[string]string{
			"issuer":                 issuer,
			"introspection_endpoint": issuer + "/oauth/v2/introspect",
			"token_endpoint":         issuer + "/oauth/v2/token",
			"jwks_uri":               issuer + "/oauth/v2/keys",
		})
	})
	mux.HandleFunc("/oauth/v2/introspect", func(w http.ResponseWriter, r *http.Request) {
		fake.introspections.Add(1)
		id, secret, ok := r.BasicAuth()
		if !ok || id != clientID || secret != clientSecret {
			http.Error(w, "unauthorized", http.StatusUnauthorized)

			return
		}
		if err := r.ParseForm(); err != nil || r.PostForm.Get("token") != writerToken {
			respond(w, map[string]any{"active": false})

			return
		}
		respond(w, map[string]any{
			"active":             true,
			"sub":                "399193312025837589",
			"name":               "Writer User",
			"preferred_username": "writer",
			"email":              "writer@test.com",
			"email_verified":     true,
			"exp":                time.Now().Add(time.Hour).Unix(),
			"urn:zitadel:iam:org:project:roles": map[string]any{
				"writer": map[string]string{"399193235035062293": "zitadel.auth.localhost"},
				"user":   map[string]string{"399193235035062293": "zitadel.auth.localhost"},
			},
		})
	})
	fake.Server = httptest.NewServer(mux)
	t.Cleanup(fake.Close)

	return fake
}

func newVerifier(t *testing.T, fake *fakeZitadel, secret string) *auth.ZitadelVerifier {
	t.Helper()
	verifier, err := auth.NewZitadelVerifier(context.Background(), auth.ZitadelConfig{
		IssuerURL:    issuer,
		InternalURL:  fake.URL,
		ClientID:     clientID,
		ClientSecret: secret,
	})
	if err != nil {
		t.Fatalf("NewZitadelVerifier: %v", err)
	}

	return verifier
}

func TestZitadelVerifierMapsTheIntrospectedClaims(t *testing.T) {
	fake := newFakeZitadel(t)
	verifier := newVerifier(t, fake, clientSecret)

	viewer, err := verifier.Verify(context.Background(), writerToken)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if viewer.Subject != "399193312025837589" || viewer.Name != "Writer User" || viewer.PreferredUsername != "writer" ||
		viewer.Email != "writer@test.com" || !viewer.EmailVerified || viewer.OrgID != "" {
		t.Errorf("viewer = %+v", viewer)
	}
	if !slices.Equal(viewer.Roles, []string{"user", "writer"}) {
		t.Errorf("roles = %v, want [user writer]", viewer.Roles)
	}
}

func TestZitadelVerifierReachesTheInstanceByItsIssuerHost(t *testing.T) {
	fake := newFakeZitadel(t)

	newVerifier(t, fake, clientSecret)

	if len(fake.hosts) == 0 || fake.hosts[0] != "auth.localhost:8080" {
		t.Errorf("discovery was sent with hosts %v, want auth.localhost:8080", fake.hosts)
	}
}

func TestZitadelVerifierRejectsATokenThatIsNotActive(t *testing.T) {
	fake := newFakeZitadel(t)
	verifier := newVerifier(t, fake, clientSecret)

	_, err := verifier.Verify(context.Background(), "eyJhbGciOiJSUzI1NiJ9.e30.revoked")

	if err == nil {
		t.Error("an inactive token must be rejected")
	}
}

func TestZitadelVerifierRejectsWrongClientCredentials(t *testing.T) {
	fake := newFakeZitadel(t)
	verifier := newVerifier(t, fake, "not-the-secret")

	_, err := verifier.Verify(context.Background(), writerToken)

	if err == nil {
		t.Error("introspection with the wrong secret must fail")
	}
}

func TestZitadelVerifierIntrospectsATokenOnlyOncePerCachePeriod(t *testing.T) {
	fake := newFakeZitadel(t)
	verifier := newVerifier(t, fake, clientSecret)

	for range 3 {
		if _, err := verifier.Verify(context.Background(), writerToken); err != nil {
			t.Fatal(err)
		}
	}

	if got := fake.introspections.Load(); got != 1 {
		t.Errorf("introspections = %d, want 1", got)
	}
}

func TestNewZitadelVerifierFailsWhenTheInstanceCannotBeReached(t *testing.T) {
	fake := newFakeZitadel(t)
	fake.Close()

	_, err := auth.NewZitadelVerifier(context.Background(), auth.ZitadelConfig{
		IssuerURL:    issuer,
		InternalURL:  fake.URL,
		ClientID:     clientID,
		ClientSecret: clientSecret,
	})

	if err == nil {
		t.Error("expected an error when the introspection endpoint cannot be discovered")
	}
}
