package narration

import (
	"log/slog"

	genqlient "github.com/Khan/genqlient/graphql"
	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/background"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/objectstorage"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/redis"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server/route"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/ttscallbacks"
)

func Module() fx.Option {
	return fx.Module(
		"narration",
		fx.Provide(newService, route.Provide(statusRoute)),
		fx.Invoke(func(lc fx.Lifecycle, service *Service) {
			background.Keep(lc, service.KeepListening)
		}),
	)
}

func newService(
	cfg config.Config,
	client *ent.Client,
	cache *redis.Client,
	storage *objectstorage.Client,
	beatriceClient genqlient.Client,
	logger *slog.Logger,
) *Service {
	return NewService(
		client,
		cache,
		storage,
		beatriceClient,
		cfg.Beatrice.DefaultVoice,
		cfg.App.InternalURL,
		logger,
	)
}

func statusRoute(service *Service, logger *slog.Logger) route.Route {
	return route.Route{
		Pattern: "POST /beatrice-callbacks/status",
		Handler: ttscallbacks.Status(service.Handle, logger),
	}
}
