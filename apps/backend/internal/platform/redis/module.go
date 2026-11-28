package redis

import (
	"context"
	"log/slog"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

func Module() fx.Option {
	return fx.Module("redis", fx.Provide(
		func(
			lc fx.Lifecycle,
			cfg config.Config,
			logger *slog.Logger,
		) (*Client, error) {
			client, err := Open(context.Background(), cfg.Redis, logger)
			if err != nil {
				return nil, err
			}
			lc.Append(fx.Hook{OnStop: func(ctx context.Context) error {
				client.Close(ctx)

				return nil
			}})

			return client, nil
		},
	))
}
