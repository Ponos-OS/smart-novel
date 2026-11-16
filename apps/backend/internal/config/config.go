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
	Storage  ObjectStorage
	Beatrice Beatrice
	Stats    Stats
	Fithara  Fithara
	OTel     OTel
}

type App struct {
	ServiceName string
	// InternalURL is how a service of the cluster reaches this backend, which Beatrice needs for its callbacks.
	InternalURL        string
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

// ObjectStorage is the S3-compatible bucket of the covers and the narration audio.
type ObjectStorage struct {
	Region string
	// Endpoint is where the backend reaches the bucket; empty means AWS.
	Endpoint string
	// PublicURL is where a browser reaches it, and the base of the URLs the backend hands out.
	PublicURL string
	Bucket    string
	// AccessKey and SecretKey are empty when the credentials come from the environment of the machine, as on AWS.
	AccessKey string
	SecretKey string
}

// Beatrice is the service that explains words and narrates chapters with an LLM.
type Beatrice struct {
	// URL is its GraphQL endpoint.
	URL string
	// DefaultVoice is the voice every narration is made with.
	DefaultVoice string
	Timeout      time.Duration
	// ExplanationTTL is how long an explanation of a word is kept.
	ExplanationTTL time.Duration
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

	defaultFitharaTimeout  = 60 * time.Second
	defaultBeatriceTimeout = 180 * time.Second
	defaultExplanationTTL  = 12 * time.Hour

	LogsExporterOTLP   = "otlp"
	LogsExporterStdout = "stdout"
)

// Load reads and validates every setting, so a bad deployment reports all its mistakes at once.
func Load(lookup Lookup) (Config, error) {
	r := &reader{lookup: lookup}

	cfg := Config{
		App: App{
			ServiceName:        r.text("SERVICE_NAME", "smart-novel-backend"),
			InternalURL:        r.required("BACKEND_INTERNAL_URL"),
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
		Storage: r.objectStorage(),
		Beatrice: Beatrice{
			URL:            r.required("BEATRICE_URL"),
			DefaultVoice:   r.required("BEATRICE_DEFAULT_VOICE"),
			Timeout:        r.duration("BEATRICE_TIMEOUT", defaultBeatriceTimeout),
			ExplanationTTL: r.duration("LLM_CACHE_TTL", defaultExplanationTTL),
		},
		Stats: Stats{
			SnapshotSchedule: r.schedule("STATS_SNAPSHOT_CRON"),
		},
		Fithara: Fithara{
			URL:     r.required("FITHARA_URL"),
			Timeout: r.duration("FITHARA_TIMEOUT", defaultFitharaTimeout),
		},
		OTel: r.otel(),
	}
	if cfg.Database.SyncSchema && cfg.App.Env == EnvProduction {
		r.fail("DEV_SYNC_DATABASE_SCHEMA", "must not be true when APP_ENV is production: production applies the versioned migrations")
	}
	if (cfg.Storage.AccessKey == "") != (cfg.Storage.SecretKey == "") {
		r.fail("OBJECT_STORAGE_ACCESS_KEY", "and OBJECT_STORAGE_SECRET_KEY must be set together")
	}
	if cfg.OTel.Enabled && cfg.OTel.Endpoint == "" {
		r.fail("OTEL_EXPORTER_OTLP_ENDPOINT", "is required when OTEL_ENABLED is true")
	}
	if err := r.err(); err != nil {
		return Config{}, fmt.Errorf("invalid configuration: %w", err)
	}

	return cfg, nil
}
