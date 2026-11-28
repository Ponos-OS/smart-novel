package telemetry

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

const flushTimeout = 10 * time.Second

func Module() fx.Option {
	return fx.Module(
		"telemetry",
		fx.Provide(
			newTelemetry,
			func(t *Telemetry) trace.TracerProvider { return t.TracerProvider() },
			func(t *Telemetry) propagation.TextMapPropagator {
				return t.Propagator()
			},
		),
	)
}

func newTelemetry(lc fx.Lifecycle, cfg config.Config) (*Telemetry, error) {
	t, err := Start(context.Background(), cfg)
	if err != nil {
		return nil, err
	}
	lc.Append(fx.Hook{OnStop: func(ctx context.Context) error {
		flushCtx, cancel := context.WithTimeout(
			context.WithoutCancel(ctx),
			flushTimeout,
		)
		defer cancel()

		return t.Shutdown(flushCtx)
	}})

	return t, nil
}
