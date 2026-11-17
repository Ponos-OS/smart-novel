package ttscallbacks

import (
	"log/slog"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/objectstorage"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server/route"
)

// Module serves the upload callback; the status callback is served by internal/narration, which handles what it says.
var Module = fx.Module("ttscallbacks", fx.Provide(
	route.Provide(func(
		check *auth.IssuerCheck,
		storage *objectstorage.Client,
		logger *slog.Logger,
	) route.Route {
		return route.Route{
			Pattern: "POST /beatrice-callbacks/gen-upload-url",
			Handler: GenUploadURL(check, storage, logger),
		}
	}),
))
