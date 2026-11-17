package novel

import (
	"log/slog"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/narration"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/database"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/objectstorage"
)

var Module = fx.Module("novel", fx.Provide(
	func(
		client *ent.Client,
		db *database.Database,
		licenseService *license.Service,
		storage *objectstorage.Client,
		narrationService *narration.Service,
		logger *slog.Logger,
	) *Service {
		return NewService(
			client,
			db,
			licenseService,
			storage,
			narrationService,
			logger,
		)
	},
))
