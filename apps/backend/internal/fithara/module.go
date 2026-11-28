package fithara

import (
	"fmt"
	"net/http"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

func Module() fx.Option {
	return fx.Module("fithara", fx.Provide(newClient))
}

func newClient(
	cfg config.Config,
	tracerProvider trace.TracerProvider,
	propagator propagation.TextMapPropagator,
) (*ClientWithResponses, error) {
	client, err := NewClientWithResponses(
		cfg.Fithara.URL,
		WithHTTPClient(&http.Client{
			Timeout: cfg.Fithara.Timeout,
			Transport: otelhttp.NewTransport(
				http.DefaultTransport,
				otelhttp.WithTracerProvider(tracerProvider),
				otelhttp.WithPropagators(propagator),
			),
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("creating the Fithara client: %w", err)
	}

	return client, nil
}
