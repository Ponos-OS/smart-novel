package main

import (
	"log/slog"
	"time"

	"go.uber.org/fx"
	"go.uber.org/fx/fxevent"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/beatrice"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/fithara"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/llm"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/narration"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/node"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/database"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/logging"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/objectstorage"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/redis"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/telemetry"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/zitadel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platformterms"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/stats"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/ttscallbacks"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/writer"
)

const (
	// Starting waits for the database, the schema sync and the license sync.
	startTimeout = time.Minute
	// Stopping lets the running requests finish (15 seconds) and flushes telemetry.
	stopTimeout = 30 * time.Second
)

func main() {
	fx.New(options()).Run()
}

func options() fx.Option {
	return fx.Options(
		fx.StartTimeout(startTimeout),
		fx.StopTimeout(stopTimeout),
		fx.WithLogger(func(logger *slog.Logger) fxevent.Logger {
			return &fxevent.SlogLogger{Logger: logger}
		}),

		config.Module,
		telemetry.Module,
		logging.Module,
		database.Module,
		redis.Module,
		objectstorage.Module,
		zitadel.Module,
		beatrice.Module,
		fithara.Module,

		license.Module,
		narration.Module,
		llm.Module,
		stats.Module,
		tag.Module,
		novel.Module,
		chapter.Module,
		node.Module,
		writer.Module,
		platformterms.Module,
		ttscallbacks.Module,

		graph.Module,
		server.Module,
	)
}
