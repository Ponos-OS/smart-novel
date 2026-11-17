package zitadelevents

import (
	"log/slog"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/zitadel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server/route"
)

var Module = fx.Module("zitadelevents", fx.Provide(
	route.Provide(func(
		cfg config.Config,
		management *zitadel.Management,
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
))
