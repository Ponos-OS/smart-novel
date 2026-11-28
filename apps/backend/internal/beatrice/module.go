package beatrice

import (
	"net/http"

	genqlient "github.com/Khan/genqlient/graphql"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

func Module() fx.Option {
	return fx.Module("beatrice", fx.Provide(newClient))
}

func newClient(
	cfg config.Config,
	tracerProvider trace.TracerProvider,
	propagator propagation.TextMapPropagator,
) genqlient.Client {
	return genqlient.NewClient(
		cfg.Beatrice.URL,
		HTTPClient{
			HTTP: &http.Client{
				Timeout: cfg.Beatrice.Timeout,
				Transport: otelhttp.NewTransport(
					http.DefaultTransport,
					otelhttp.WithTracerProvider(tracerProvider),
					otelhttp.WithPropagators(propagator),
				),
			},
		},
	)
}
