package writer

import (
	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/zitadel"
)

var Module = fx.Module("writer", fx.Provide(
	func(client *ent.Client, management *zitadel.Management) *Service {
		return NewService(client, management)
	},
))
