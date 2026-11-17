// Package zitadel is everything the backend does with ZITADEL: introspecting access tokens, checking who issued one, granting project roles, and receiving its user events (Actions v2).
package zitadel

import (
	"context"
	"fmt"
	"net/url"
	"slices"
	"strconv"

	"github.com/zitadel/zitadel-go/v3/pkg/client"
	"github.com/zitadel/zitadel-go/v3/pkg/client/zitadel/authorization/v2"
	"github.com/zitadel/zitadel-go/v3/pkg/client/zitadel/filter/v2"
	"github.com/zitadel/zitadel-go/v3/pkg/client/zitadel/user/v2"
	zitadelapi "github.com/zitadel/zitadel-go/v3/pkg/zitadel"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

const defaultHTTPPort = "80"

// Management changes what a user may do in the project.
type Management struct {
	api       *client.Client
	projectID string
}

// NewManagement connects lazily with the personal access token of the backend's service user, so ZITADEL does not have to be up yet.
// The calls go to the internal URL when there is one and carry the issuer's host as the authority, which is how ZITADEL finds its instance.
func NewManagement(
	ctx context.Context,
	cfg config.Zitadel,
) (*Management, error) {
	issuer, err := url.Parse(cfg.IssuerURL)
	if err != nil {
		return nil, fmt.Errorf("reading ZITADEL_ISSUER_URL: %w", err)
	}
	target := issuer
	if cfg.InternalURL != "" {
		if target, err = url.Parse(cfg.InternalURL); err != nil {
			return nil, fmt.Errorf("reading ZITADEL_INTERNAL_URL: %w", err)
		}
	}
	api, err := instance(target)
	if err != nil {
		return nil, err
	}
	zitadelClient, err := client.New(ctx, api,
		client.WithAuth(client.PAT(cfg.ManagementPAT)),
		client.WithGRPCDialOptions(grpc.WithAuthority(issuer.Host)),
	)
	if err != nil {
		return nil, fmt.Errorf("creating the ZITADEL client: %w", err)
	}

	return &Management{api: zitadelClient, projectID: cfg.ProjectID}, nil
}

func instance(target *url.URL) (*zitadelapi.Zitadel, error) {
	port := target.Port()
	if target.Scheme == "http" {
		if port == "" {
			port = defaultHTTPPort
		}

		return zitadelapi.New(
			target.Hostname(),
			zitadelapi.WithInsecure(port),
		), nil
	}
	if port == "" {
		return zitadelapi.New(target.Hostname()), nil
	}
	number, err := strconv.ParseUint(port, 10, 16)
	if err != nil {
		return nil, fmt.Errorf(
			"reading the port %q of the ZITADEL URL: %w",
			port,
			err,
		)
	}

	return zitadelapi.New(
		target.Hostname(),
		zitadelapi.WithPort(uint16(number)),
	), nil
}

// GrantProjectRoleIfAbsent gives the user the role when they hold none on the project, and leaves one they have as it is.
func (m *Management) GrantProjectRoleIfAbsent(
	ctx context.Context,
	userID string,
	role auth.Role,
) error {
	found, err := m.authorizationsOf(ctx, userID)
	if err != nil {
		return err
	}
	if len(found) > 0 {
		return nil
	}
	// Somebody else gave the user a role between the look and the grant: that is what this call is for.
	if err := m.grant(
		ctx,
		userID,
		role,
	); status.Code(
		err,
	) != codes.AlreadyExists {
		return err
	}

	return nil
}

// SetUserProjectRole makes role the only role the user holds on the project. Calling it again with the same arguments changes nothing.
func (m *Management) SetUserProjectRole(
	ctx context.Context,
	userID string,
	role auth.Role,
) error {
	found, err := m.authorizationsOf(ctx, userID)
	if err != nil {
		return err
	}
	if len(found) == 0 {
		return m.grant(ctx, userID, role)
	}
	current := found[0]
	// ZITADEL answers an update that changes nothing with an error.
	if slices.Equal(roleKeysOf(current), []string{string(role)}) {
		return nil
	}
	_, err = m.api.AuthorizationServiceV2().
		UpdateAuthorization(ctx, &authorization.UpdateAuthorizationRequest{Id: current.GetId(), RoleKeys: []string{string(role)}})

	return wrap("changing the project role", err)
}

func (m *Management) authorizationsOf(
	ctx context.Context,
	userID string,
) ([]*authorization.Authorization, error) {
	found, err := m.api.AuthorizationServiceV2().
		ListAuthorizations(ctx, &authorization.ListAuthorizationsRequest{
			Filters: []*authorization.AuthorizationsSearchFilter{
				{
					Filter: &authorization.AuthorizationsSearchFilter_InUserIds{
						InUserIds: &filter.InIDsFilter{Ids: []string{userID}},
					},
				},
				{
					Filter: &authorization.AuthorizationsSearchFilter_ProjectId{
						ProjectId: &filter.IDFilter{Id: m.projectID},
					},
				},
			},
		})
	if err != nil {
		return nil, fmt.Errorf(
			"looking for the authorizations of a user: %w",
			err,
		)
	}

	return found.GetAuthorizations(), nil
}

// grant gives the user the role in the organization the user belongs to, which ZITADEL asks for when it creates an authorization.
func (m *Management) grant(
	ctx context.Context,
	userID string,
	role auth.Role,
) error {
	found, err := m.api.UserServiceV2().
		GetUserByID(ctx, &user.GetUserByIDRequest{UserId: userID})
	if err != nil {
		return wrap("looking for the organization of the user", err)
	}
	_, err = m.api.AuthorizationServiceV2().
		CreateAuthorization(ctx, &authorization.CreateAuthorizationRequest{
			UserId:         userID,
			ProjectId:      m.projectID,
			OrganizationId: found.GetUser().GetDetails().GetResourceOwner(),
			RoleKeys:       []string{string(role)},
		})

	return wrap("granting the project role", err)
}

func roleKeysOf(current *authorization.Authorization) []string {
	keys := make([]string, len(current.GetRoles()))
	for index, role := range current.GetRoles() {
		keys[index] = role.GetKey()
	}

	return keys
}

func wrap(doing string, err error) error {
	if err == nil {
		return nil
	}

	return fmt.Errorf("%s: %w", doing, err)
}
