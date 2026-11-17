package logging

import (
	"log/slog"
	"os"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/telemetry"
)

var Module = fx.Module("logging", fx.Provide(
	func(cfg config.Config, t *telemetry.Telemetry) *slog.Logger {
		return New(cfg, os.Stdout, t.LogHandler())
	},
))
