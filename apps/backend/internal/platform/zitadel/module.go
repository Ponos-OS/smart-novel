package zitadel

import (
	"context"
	"log/slog"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server/route"
)

func Module() fx.Option {
	return fx.Module(
		"zitadel",
		fx.Provide(
			func(cfg config.Config) (*Management, error) {
				return NewManagement(context.Background(), cfg.Zitadel)
			},
			func(cfg config.Config) Config {
				return Config{
					IssuerURL:    cfg.Zitadel.IssuerURL,
					InternalURL:  cfg.Zitadel.InternalURL,
					ClientID:     cfg.Zitadel.IntrospectionClientID,
					ClientSecret: cfg.Zitadel.IntrospectionClientSecret,
				}
			},
			func(cfg Config) (auth.Verifier, error) {
				verifier, err := NewVerifier(context.Background(), cfg)
				if err != nil {
					return nil, err
				}

				return verifier, nil
			},
			func(cfg Config) (*IssuerCheck, error) {
				return NewIssuerCheck(context.Background(), cfg)
			},
			route.Provide(func(
				cfg config.Config,
				management *Management,
				logger *slog.Logger,
			) route.Route {
				return route.Route{
					Pattern: "POST /zitadel-events/user-added",
					Handler: UserAdded(
						cfg.Zitadel.WebhookSigningKey,
						management,
						logger,
					),
				}
			}),
		),
	)
}
