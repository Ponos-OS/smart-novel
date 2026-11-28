package stats

import (
	"context"
	"log/slog"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/background"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/database"
)

func Module() fx.Option {
	return fx.Module(
		"stats",
		fx.Provide(func(
			db *database.Database,
			client *ent.Client,
			logger *slog.Logger,
		) *Service {
			return NewService(db, client, logger)
		}),
		fx.Invoke(func(lc fx.Lifecycle, cfg config.Config, service *Service) {
			background.Keep(lc, func(ctx context.Context) {
				service.KeepSnapshotted(ctx, cfg.Stats.SnapshotSchedule)
			})
		}),
	)
}
