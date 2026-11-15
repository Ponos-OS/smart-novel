package config

import (
	"fmt"
	"log/slog"
	"time"
)

type Config struct {
	App      App
	Database Database
	Zitadel  Zitadel
	Redis    Redis
	Stats    Stats
	Fithara  Fithara
	OTel     OTel
}

type App struct {
	ServiceName        string
	Port               int
	Env                string
	CORSAllowedOrigins []string
	LogFormat          string
	LogLevel           slog.Level
}

type Database struct {
	URL        string
	SyncSchema bool
}

type Zitadel struct {
	IssuerURL                 string
	InternalURL               string
	IntrospectionClientID     string
	IntrospectionClientSecret string
	ProjectID                 string
	ManagementPAT             string
	WebhookSigningKey         string
}

type Redis struct {
	URL      string
	Password string
}

type Stats struct {
	// SnapshotSchedule is a five-field cron expression, in UTC.
	SnapshotSchedule string
}

// Fithara is the service of the canonical licenses and the license assistant.
type Fithara struct {
	URL     string
	Timeout time.Duration
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

	defaultFitharaTimeout = 60 * time.Second

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
		Database: Database{
			URL:        r.required("DATABASE_URL"),
			SyncSchema: r.boolean("DEV_SYNC_DATABASE_SCHEMA", false),
		},
		Zitadel: Zitadel{
			IssuerURL:                 r.required("ZITADEL_ISSUER_URL"),
			InternalURL:               r.text("ZITADEL_INTERNAL_URL", ""),
			IntrospectionClientID:     r.required("ZITADEL_INTROSPECTION_CLIENT_ID"),
			IntrospectionClientSecret: r.required("ZITADEL_INTROSPECTION_CLIENT_SECRET"),
			ProjectID:                 r.required("ZITADEL_PROJECT_ID"),
			ManagementPAT:             r.required("ZITADEL_MANAGEMENT_PAT"),
			WebhookSigningKey:         r.required("ZITADEL_WEBHOOK_SIGNING_KEY"),
		},
		Redis: Redis{
			URL:      r.required("REDIS_URL"),
			Password: r.text("REDIS_PASSWORD", ""),
		},
		Stats: Stats{
			SnapshotSchedule: r.schedule("STATS_SNAPSHOT_CRON"),
		},
		Fithara: Fithara{
			URL:     r.required("FITHARA_URL"),
			Timeout: r.duration("FITHARA_TIMEOUT", defaultFitharaTimeout),
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
	if cfg.Database.SyncSchema && cfg.App.Env == EnvProduction {
		r.fail("DEV_SYNC_DATABASE_SCHEMA", "must not be true when APP_ENV is production: production applies the versioned migrations")
	}
	if cfg.OTel.Enabled && cfg.OTel.Endpoint == "" {
		r.fail("OTEL_EXPORTER_OTLP_ENDPOINT", "is required when OTEL_ENABLED is true")
	}
	if err := r.err(); err != nil {
		return Config{}, fmt.Errorf("invalid configuration: %w", err)
	}

	return cfg, nil
}
