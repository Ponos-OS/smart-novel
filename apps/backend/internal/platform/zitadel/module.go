package zitadel

import (
	"context"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

var Module = fx.Module("zitadel", fx.Provide(
	func(cfg config.Config) (*Management, error) {
		return NewManagement(context.Background(), cfg.Zitadel)
	},
))
