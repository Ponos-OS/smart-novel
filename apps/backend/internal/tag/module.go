package tag

import (
	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/database"
)

var Module = fx.Module("tag", fx.Provide(
	func(client *ent.Client, db *database.Database) *Service {
		return NewService(client, db)
	},
))
