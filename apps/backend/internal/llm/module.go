package llm

import (
	"log/slog"

	genqlient "github.com/Khan/genqlient/graphql"
	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/redis"
)

var Module = fx.Module("llm", fx.Provide(
	func(
		cfg config.Config,
		beatriceClient genqlient.Client,
		cache *redis.Client,
		logger *slog.Logger,
	) *Service {
		return NewService(
			beatriceClient,
			cache,
			cfg.Beatrice.ExplanationTTL,
			logger,
		)
	},
))
