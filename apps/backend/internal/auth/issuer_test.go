package auth_test

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
)

// identityProvider serves the two documents a check needs and signs tokens with its key.
func identityProvider(
	t *testing.T,
) (issuer string, sign func(issuedBy string, expiresIn time.Duration) string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	jwk := jose.JSONWebKey{
		Key:       &key.PublicKey,
		KeyID:     "key-1",
		Algorithm: "RS256",
		Use:       "sig",
	}
	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	mux.HandleFunc(
		"/.well-known/openid-configuration",
		func(w http.ResponseWriter, _ *http.Request) {
			serve(
				t,
				w,
				map[string]string{
					"issuer":   server.URL,
					"jwks_uri": server.URL + "/keys",
				},
			)
		},
	)
	mux.HandleFunc("/keys", func(w http.ResponseWriter, _ *http.Request) {
		serve(t, w, jose.JSONWebKeySet{Keys: []jose.JSONWebKey{jwk}})
	})
	signer, err := jose.NewSigner(
		jose.SigningKey{
			Algorithm: jose.RS256,
			Key:       jose.JSONWebKey{Key: key, KeyID: "key-1"},
		},
		(&jose.SignerOptions{}).WithType("JWT"),
	)
	if err != nil {
		t.Fatal(err)
	}

	return server.URL, func(issuedBy string, expiresIn time.Duration) string {
		token, signErr := jwt.Signed(signer).
			Claims(jwt.Claims{Issuer: issuedBy, Subject: "399193312042418199", Expiry: jwt.NewNumericDate(time.Now().Add(expiresIn))}).
			Serialize()
		if signErr != nil {
			t.Fatal(signErr)
		}

		return token
	}
}

func TestIssuerCheckAcceptsATokenOfTheIssuerWhetherOrNotItExpired(
	t *testing.T,
) {
	issuer, sign := identityProvider(t)
	uut, err := auth.NewIssuerCheck(
		t.Context(),
		auth.ZitadelConfig{IssuerURL: issuer},
	)
	if err != nil {
		t.Fatal(err)
	}

	for name, expiresIn := range map[string]time.Duration{"a token that is valid": time.Hour, "a token that expired a day ago": -24 * time.Hour} {
		t.Run(name, func(t *testing.T) {
			err := uut.Verify(t.Context(), sign(issuer, expiresIn))
			if err != nil {
				t.Errorf("got %v, want the token accepted", err)
			}
		})
	}
}

func TestIssuerCheckRefusesWhatTheIssuerDidNotSign(t *testing.T) {
	issuer, sign := identityProvider(t)
	_, otherSign := identityProvider(t)
	uut, err := auth.NewIssuerCheck(
		t.Context(),
		auth.ZitadelConfig{IssuerURL: issuer},
	)
	if err != nil {
		t.Fatal(err)
	}
	valid := sign(issuer, time.Hour)
	parts := strings.Split(valid, ".")
	header, payload, signature := parts[0], parts[1], parts[2]

	cases := map[string]string{
		"a token signed by another key": otherSign(issuer, time.Hour),
		"a token of another issuer": sign(
			"http://elsewhere.example",
			time.Hour,
		),
		"a token whose signature changed": header + "." + payload + "." + flipped(
			signature,
		),
		"a token whose payload changed": header + "." + flipped(
			payload,
		) + "." + signature,
		"something that is not a token":    "not-a-token",
		"a token without a signature part": header + "." + payload,
	}
	for name, token := range cases {
		t.Run(name, func(t *testing.T) {
			err := uut.Verify(t.Context(), token)

			if err == nil {
				t.Error("the token was accepted")
			}
		})
	}
}

func serve(t *testing.T, w http.ResponseWriter, document any) {
	t.Helper()
	if err := json.NewEncoder(w).Encode(document); err != nil {
		t.Error(err)
	}
}

func flipped(part string) string {
	middle := len(part) / 2
	replacement := "A"
	if part[middle] == 'A' {
		replacement = "B"
	}

	return part[:middle] + replacement + part[middle+1:]
}

func TestNewIssuerCheckFailsWhenTheIssuerCannotBeReached(t *testing.T) {
	_, err := auth.NewIssuerCheck(
		t.Context(),
		auth.ZitadelConfig{IssuerURL: "http://127.0.0.1:1"},
	)

	if err == nil {
		t.Error("the check was made without keys to check with")
	}
}
