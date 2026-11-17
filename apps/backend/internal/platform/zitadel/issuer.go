package zitadel

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/zitadel/oidc/v3/pkg/client"
	"github.com/zitadel/oidc/v3/pkg/client/rp"
	"github.com/zitadel/oidc/v3/pkg/oidc"
)

var errWrongIssuer = errors.New("the token was issued by somebody else")

// IssuerCheck says whether ZITADEL issued a token, by its signature and its issuer; it does not look at the expiry. That is for a call that outlives the token: Beatrice may pick a job up long after the access token of the writer who started it has expired, and it brings that token back on its callbacks.
type IssuerCheck struct {
	issuer string
	keys   oidc.KeySet
}

// NewIssuerCheck finds the signing keys of the issuer, so the backend does not start when ZITADEL cannot be reached, like the check of every
// other request. The key set it keeps looks the keys up again when ZITADEL rotates one.
func NewIssuerCheck(
	ctx context.Context,
	cfg Config,
) (*IssuerCheck, error) {
	issuer, err := url.Parse(cfg.IssuerURL)
	if err != nil || issuer.Host == "" {
		return nil, fmt.Errorf("issuer URL %q %w", cfg.IssuerURL, errBadURL)
	}
	connection, err := httpClient(issuer, cfg.InternalURL)
	if err != nil {
		return nil, err
	}
	trimmed := strings.TrimRight(cfg.IssuerURL, "/")
	discovered, err := client.Discover(ctx, trimmed, connection)
	if err != nil {
		return nil, fmt.Errorf(
			"finding the signing keys of %s: %w",
			trimmed,
			err,
		)
	}

	return &IssuerCheck{
		issuer: trimmed,
		keys:   rp.NewRemoteKeySet(connection, discovered.JwksURI),
	}, nil
}

// Verify returns nil for a token ZITADEL signed, expired or not.
func (c *IssuerCheck) Verify(ctx context.Context, token string) error {
	var claims oidc.TokenClaims
	payload, err := oidc.ParseToken(token, &claims)
	if err != nil {
		return fmt.Errorf("reading the token: %w", err)
	}
	if strings.TrimRight(claims.Issuer, "/") != c.issuer {
		return errWrongIssuer
	}

	return oidc.CheckSignature(
		ctx,
		token,
		payload,
		&claims,
		[]string{"RS256"},
		c.keys,
	)
}
