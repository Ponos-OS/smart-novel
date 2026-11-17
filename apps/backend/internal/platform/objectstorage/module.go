package objectstorage

import (
	"context"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

var Module = fx.Module("objectstorage", fx.Provide(
	func(cfg config.Config) (*Client, error) {
		return Open(context.Background(), cfg.Storage)
	},
))
