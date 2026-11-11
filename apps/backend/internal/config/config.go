package config

import (
	"fmt"
	"log/slog"
	"time"
)

type Config struct {
	App  App
	OTel OTel
}

type App struct {
	ServiceName        string
	Port               int
	Env                string
	CORSAllowedOrigins []string
	LogFormat          string
	LogLevel           slog.Level
}

type OTel struct {
	Enabled          bool
	Endpoint         string
	TracesSampler    string
	TracesSamplerArg float64
	MaxQueueSize     int
	BatchSize        int
	FlushInterval    time.Duration
	ExportTimeout    time.Duration
	LogsExporter     string
}

const (
	EnvDevelopment = "development"
	EnvProduction  = "production"
	EnvTest        = "test"

	LogFormatText = "text"
	LogFormatJSON = "json"

	defaultMaxQueueSize  = 2048
	defaultBatchSize     = 512
	defaultFlushInterval = 5 * time.Second
	defaultExportTimeout = 30 * time.Second

	LogsExporterOTLP   = "otlp"
	LogsExporterStdout = "stdout"
)

// Load reads and validates every setting, so a bad deployment reports all its mistakes at once.
func Load(lookup Lookup) (Config, error) {
	r := &reader{lookup: lookup}

	cfg := Config{
		App: App{
			ServiceName:        r.text("SERVICE_NAME", "smart-novel-backend"),
			Port:               r.port("PORT"),
			Env:                r.oneOf("APP_ENV", []string{EnvDevelopment, EnvProduction, EnvTest}, ""),
			CORSAllowedOrigins: r.list("CORS_ALLOWED_ORIGINS"),
			LogFormat:          r.oneOf("LOG_FORMAT", []string{LogFormatText, LogFormatJSON}, LogFormatText),
			LogLevel:           r.logLevel("LOG_LEVEL", slog.LevelInfo),
		},
		OTel: OTel{
			Enabled:          r.boolean("OTEL_ENABLED", false),
			Endpoint:         r.text("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
			TracesSampler:    r.oneOf("OTEL_TRACES_SAMPLER", []string{"parentbased_traceidratio", "traceidratio", "always_on", "always_off"}, "parentbased_traceidratio"),
			TracesSamplerArg: r.ratio("OTEL_TRACES_SAMPLER_ARG", 1),
			MaxQueueSize:     r.positiveInt("OTEL_BATCH_MAX_PENDING_SPANS", defaultMaxQueueSize),
			BatchSize:        r.positiveInt("OTEL_BATCH_SPANS_PER_EXPORT", defaultBatchSize),
			FlushInterval:    r.milliseconds("OTEL_BATCH_FLUSH_INTERVAL_MS", defaultFlushInterval),
			ExportTimeout:    r.milliseconds("OTEL_BATCH_EXPORT_TIMEOUT_MS", defaultExportTimeout),
			LogsExporter:     r.oneOf("OTEL_LOGS_EXPORTER", []string{LogsExporterOTLP, LogsExporterStdout}, LogsExporterStdout),
		},
	}
	if cfg.OTel.Enabled && cfg.OTel.Endpoint == "" {
		r.fail("OTEL_EXPORTER_OTLP_ENDPOINT", "is required when OTEL_ENABLED is true")
	}
	if err := r.err(); err != nil {
		return Config{}, fmt.Errorf("invalid configuration: %w", err)
	}

	return cfg, nil
}
