package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/zitadel/oidc/v3/pkg/client/rs"
	"github.com/zitadel/zitadel-go/v3/pkg/authorization"
	"github.com/zitadel/zitadel-go/v3/pkg/authorization/oauth"
	"github.com/zitadel/zitadel-go/v3/pkg/zitadel"
)

const (
	dialTimeout    = 10 * time.Second
	requestTimeout = 15 * time.Second

	// cacheTTL is how long a successful introspection is reused; it is also the longest a revoked token keeps working.
	cacheTTL = 30 * time.Second
	// cacheMaxEntries keeps a flood of distinct tokens from growing memory without bound.
	cacheMaxEntries = 10_000

	rolesClaim = "urn:zitadel:iam:org:project:roles"
	orgIDClaim = "urn:zitadel:iam:org:id"
)

var (
	errBadURL        = errors.New("is not a URL")
	errBadPort       = errors.New("is not a port")
	errTokenInactive = errors.New("token is not active")
)

// ZitadelConfig says where the identity provider is and how the backend introspects tokens with it.
type ZitadelConfig struct {
	// IssuerURL is the public URL tokens carry as their issuer, e.g. http://auth.localhost:8080 or https://smart-novel.com
	IssuerURL string
	// InternalURL, when set, is where the backend actually reaches ZITADEL (an ingress inside the cluster); requests still carry the issuer's host.
	InternalURL string
	// ClientID and ClientSecret belong to an API application of the project (basic authentication).
	ClientID     string
	ClientSecret string
}

// ZitadelVerifier checks access tokens by introspecting them at ZITADEL, with the result cached for a short time.
type ZitadelVerifier struct {
	authorizer *authorization.Authorizer[*oauth.IntrospectionContext]
}

// NewZitadelVerifier discovers the introspection endpoint of the issuer and prepares the verifier.
func NewZitadelVerifier(ctx context.Context, cfg ZitadelConfig) (*ZitadelVerifier, error) {
	issuer, err := url.Parse(cfg.IssuerURL)
	if err != nil || issuer.Host == "" {
		return nil, fmt.Errorf("issuer URL %q %w", cfg.IssuerURL, errBadURL)
	}
	client, err := httpClient(issuer, cfg.InternalURL)
	if err != nil {
		return nil, err
	}
	options, err := instanceOptions(issuer)
	if err != nil {
		return nil, err
	}
	instance := zitadel.New(issuer.Hostname(), options...)
	initialize := func(ctx context.Context, instance *zitadel.Zitadel) (authorization.Verifier[*oauth.IntrospectionContext], error) {
		server, serverErr := rs.NewResourceServerClientCredentials(ctx, instance.Origin(), cfg.ClientID, cfg.ClientSecret, rs.WithClient(client))
		if serverErr != nil {
			return nil, fmt.Errorf("reaching the introspection endpoint of %s: %w", instance.Origin(), serverErr)
		}

		return oauth.NewIntrospectionVerificationWithCache[*oauth.IntrospectionContext](server, newTokenCache(), cacheTTL), nil
	}
	authorizer, err := authorization.New(ctx, instance, initialize)
	if err != nil {
		return nil, err
	}

	return &ZitadelVerifier{authorizer: authorizer}, nil
}

// Verify implements Verifier.
func (v *ZitadelVerifier) Verify(ctx context.Context, accessToken string) (Viewer, error) {
	introspected, err := v.authorizer.CheckAuthorization(ctx, "Bearer "+accessToken)
	if err != nil {
		return Viewer{}, err
	}
	if !introspected.IsAuthorized() {
		return Viewer{}, errTokenInactive
	}

	return viewerOf(introspected), nil
}

func viewerOf(introspected *oauth.IntrospectionContext) Viewer {
	return Viewer{
		Subject:           introspected.Subject,
		Name:              introspected.Name,
		PreferredUsername: introspected.PreferredUsername,
		Email:             introspected.Email,
		EmailVerified:     bool(introspected.EmailVerified),
		OrgID:             stringClaim(introspected.Claims, orgIDClaim),
		Roles:             rolesOf(introspected.Claims),
	}
}

func stringClaim(claims map[string]any, name string) string {
	if value, ok := claims[name].(string); ok {
		return value
	}

	return ""
}

func mapClaim(claims map[string]any, name string) map[string]any {
	if value, ok := claims[name].(map[string]any); ok {
		return value
	}

	return nil
}

// rolesOf reads the role names out of the claim, which maps each role to the organizations that granted it.
func rolesOf(claims map[string]any) []string {
	granted := mapClaim(claims, rolesClaim)
	roles := make([]string, 0, len(granted))
	for role := range granted {
		roles = append(roles, role)
	}
	slices.Sort(roles)

	return roles
}

func instanceOptions(issuer *url.URL) ([]zitadel.Option, error) {
	port := issuer.Port()
	if issuer.Scheme == "http" {
		if port == "" {
			port = "80"
		}

		return []zitadel.Option{zitadel.WithInsecure(port)}, nil
	}
	if port == "" {
		return nil, nil
	}

	number, err := strconv.ParseUint(port, 10, 16) // Validates port ain't exceeding 65535
	if err != nil {
		return nil, fmt.Errorf("issuer port %q %w", port, errBadPort)
	}

	return []zitadel.Option{zitadel.WithPort(uint16(number))}, nil
}

// httpClient reaches the issuer's address through internalURL when one is given. The request URL, and so the Host header, stays the issuer's, because ZITADEL picks its instance by host.
func httpClient(issuer *url.URL, internalURL string) (*http.Client, error) {
	if internalURL == "" {
		return http.DefaultClient, nil
	}
	internal, err := url.Parse(internalURL)
	if err != nil || internal.Host == "" {
		return nil, fmt.Errorf("internal URL %q %w", internalURL, errBadURL)
	}
	from, to := hostPort(issuer), hostPort(internal)
	transport := &http.Transport{Proxy: http.ProxyFromEnvironment, ForceAttemptHTTP2: true}
	dialer := &net.Dialer{Timeout: dialTimeout}

	// A local-cluster workaround. In production it does nothing
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		if address == from {
			address = to
		}

		return dialer.DialContext(ctx, network, address)
	}

	return &http.Client{Transport: transport, Timeout: requestTimeout}, nil
}

func hostPort(u *url.URL) string {
	port := u.Port()
	if port == "" {
		port = "80"
		if u.Scheme == "https" {
			port = "443"
		}
	}

	return net.JoinHostPort(u.Hostname(), port)
}

// tokenCache keeps introspection results by the hash of the token, so tokens are not held in memory.
type tokenCache struct {
	mu      sync.Mutex
	entries map[string]cacheEntry
	now     func() time.Time
}

type cacheEntry struct {
	value   *oauth.IntrospectionContext
	expires time.Time
}

func newTokenCache() *tokenCache {
	return &tokenCache{entries: make(map[string]cacheEntry), now: time.Now}
}

func (c *tokenCache) Get(token string) (*oauth.IntrospectionContext, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	key := cacheKey(token)
	entry, ok := c.entries[key]
	if !ok {
		return nil, false
	}
	if !c.now().Before(entry.expires) {
		delete(c.entries, key)

		return nil, false
	}

	return entry.value, true
}

// Set never keeps an entry past the expiry of the token itself.
func (c *tokenCache) Set(token string, value *oauth.IntrospectionContext, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	expires := now.Add(ttl)
	if tokenExpiry := value.Expiration.AsTime(); !tokenExpiry.IsZero() && tokenExpiry.Before(expires) {
		expires = tokenExpiry
	}
	if len(c.entries) >= cacheMaxEntries {
		c.evictExpired(now)
	}
	if len(c.entries) >= cacheMaxEntries {
		return
	}
	c.entries[cacheKey(token)] = cacheEntry{value: value, expires: expires}
}

func (c *tokenCache) evictExpired(now time.Time) {
	for key, entry := range c.entries {
		if !now.Before(entry.expires) {
			delete(c.entries, key)
		}
	}
}

func cacheKey(token string) string {
	sum := sha256.Sum256([]byte(token))

	return strings.ToLower(hex.EncodeToString(sum[:]))
}
