package license

import (
	"context"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/background"
)

var Module = fx.Module("license", fx.Provide(NewService), fx.Invoke(start))

func start(lc fx.Lifecycle, service *Service) {
	lc.Append(fx.Hook{OnStart: func(ctx context.Context) error {
		_, err := service.EnsureDefault(ctx)

		return err
	}})
	background.Keep(lc, service.KeepCanonicalSynced)
}
