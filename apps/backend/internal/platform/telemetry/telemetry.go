package telemetry

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/url"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.40.0"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

// Telemetry owns the OpenTelemetry providers; the zero value is what a disabled SDK looks like.
type Telemetry struct {
	logHandler slog.Handler
	shutdowns  []func(context.Context) error
}

// LogHandler ships records to the collector, or is nil when logs stay on stdout.
func (t *Telemetry) LogHandler() slog.Handler {
	return t.logHandler
}

func (t *Telemetry) Shutdown(ctx context.Context) error {
	errs := make([]error, 0, len(t.shutdowns))
	for _, shutdown := range t.shutdowns {
		errs = append(errs, shutdown(ctx))
	}

	return errors.Join(errs...)
}

// Start sends traces to the collector and, when OTEL_LOGS_EXPORTER is otlp, logs too. There are no metrics.
func Start(ctx context.Context, cfg config.Config) (*Telemetry, error) {
	t := &Telemetry{}
	if !cfg.OTel.Enabled {
		return t, nil
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(cfg.App.ServiceName),
			semconv.DeploymentEnvironmentName(cfg.App.Env),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("telemetry resource: %w", err)
	}

	otel.SetTextMapPropagator(
		propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		),
	)

	if err := t.startTraces(ctx, cfg, res); err != nil {
		return nil, err
	}
	if cfg.OTel.LogsExporter == config.LogsExporterOTLP {
		if err := t.startLogs(ctx, cfg, res); err != nil {
			return nil, errors.Join(err, t.Shutdown(ctx))
		}
	}

	return t, nil
}

func signalURL(endpoint, path string) (string, error) {
	return url.JoinPath(endpoint, path)
}

func (t *Telemetry) startTraces(
	ctx context.Context,
	cfg config.Config,
	res *resource.Resource,
) error {
	endpoint, err := signalURL(cfg.OTel.Endpoint, "v1/traces")
	if err != nil {
		return fmt.Errorf("OTEL_EXPORTER_OTLP_ENDPOINT: %w", err)
	}
	exporter, err := otlptracehttp.New(
		ctx,
		otlptracehttp.WithEndpointURL(endpoint),
	)
	if err != nil {
		return fmt.Errorf("trace exporter: %w", err)
	}

	provider := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sampler(cfg.OTel)),
		sdktrace.WithBatcher(exporter,
			sdktrace.WithMaxQueueSize(cfg.OTel.MaxQueueSize),
			sdktrace.WithMaxExportBatchSize(cfg.OTel.BatchSize),
			sdktrace.WithBatchTimeout(cfg.OTel.FlushInterval),
			sdktrace.WithExportTimeout(cfg.OTel.ExportTimeout),
		),
	)
	otel.SetTracerProvider(provider)
	t.shutdowns = append(t.shutdowns, provider.Shutdown)

	return nil
}

func (t *Telemetry) startLogs(
	ctx context.Context,
	cfg config.Config,
	res *resource.Resource,
) error {
	endpoint, err := signalURL(cfg.OTel.Endpoint, "v1/logs")
	if err != nil {
		return fmt.Errorf("OTEL_EXPORTER_OTLP_ENDPOINT: %w", err)
	}
	exporter, err := otlploghttp.New(ctx, otlploghttp.WithEndpointURL(endpoint))
	if err != nil {
		return fmt.Errorf("log exporter: %w", err)
	}

	provider := sdklog.NewLoggerProvider(
		sdklog.WithResource(res),
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter,
			sdklog.WithMaxQueueSize(cfg.OTel.MaxQueueSize),
			sdklog.WithExportMaxBatchSize(cfg.OTel.BatchSize),
			sdklog.WithExportInterval(cfg.OTel.FlushInterval),
			sdklog.WithExportTimeout(cfg.OTel.ExportTimeout),
		)),
	)
	t.logHandler = otelslog.NewHandler(
		cfg.App.ServiceName,
		otelslog.WithLoggerProvider(provider),
	)
	t.shutdowns = append(t.shutdowns, provider.Shutdown)

	return nil
}

func sampler(cfg config.OTel) sdktrace.Sampler {
	switch cfg.TracesSampler {
	case "always_on":
		return sdktrace.AlwaysSample()
	case "always_off":
		return sdktrace.NeverSample()
	case "traceidratio":
		return sdktrace.TraceIDRatioBased(cfg.TracesSamplerArg)
	default:
		return sdktrace.ParentBased(
			sdktrace.TraceIDRatioBased(cfg.TracesSamplerArg),
		)
	}
}
