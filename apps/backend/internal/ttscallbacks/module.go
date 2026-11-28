package ttscallbacks

import (
	"log/slog"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/objectstorage"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/zitadel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server/route"
)

// Module serves the upload callback; the status callback is served by internal/narration, which handles what it says.
func Module() fx.Option {
	return fx.Module("ttscallbacks", fx.Provide(
		route.Provide(func(
			check *zitadel.IssuerCheck,
			storage *objectstorage.Client,
			logger *slog.Logger,
		) route.Route {
			return route.Route{
				Pattern: "POST /beatrice-callbacks/gen-upload-url",
				Handler: GenUploadURL(check, storage, logger),
			}
		}),
	))
}
