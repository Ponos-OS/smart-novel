package auth

import (
	"context"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

var Module = fx.Module(
	"auth",
	fx.Provide(
		func(cfg config.Config) ZitadelConfig {
			return ZitadelConfig{
				IssuerURL:    cfg.Zitadel.IssuerURL,
				InternalURL:  cfg.Zitadel.InternalURL,
				ClientID:     cfg.Zitadel.IntrospectionClientID,
				ClientSecret: cfg.Zitadel.IntrospectionClientSecret,
			}
		},
		func(cfg ZitadelConfig) (Verifier, error) {
			verifier, err := NewZitadelVerifier(context.Background(), cfg)
			if err != nil {
				return nil, err
			}

			return verifier, nil
		},
		func(cfg ZitadelConfig) (*IssuerCheck, error) {
			return NewIssuerCheck(context.Background(), cfg)
		},
	),
)
