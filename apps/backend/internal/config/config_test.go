package config_test

import (
	"strings"
	"testing"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

func environment(overrides map[string]string) config.Lookup {
	values := map[string]string{
		"PORT":                                "3000",
		"APP_ENV":                             "development",
		"CORS_ALLOWED_ORIGINS":                "http://localhost:8080, https://novels.example.com,",
		"LOG_FORMAT":                          "text",
		"LOG_LEVEL":                           "info",
		"DATABASE_URL":                        "postgresql://postgres:postgres@postgres:5432/smart_novel",
		"ZITADEL_ISSUER_URL":                  "http://auth.localhost:8080",
		"ZITADEL_INTERNAL_URL":                "http://traefik:80",
		"ZITADEL_INTROSPECTION_CLIENT_ID":     "399193312042418199",
		"ZITADEL_INTROSPECTION_CLIENT_SECRET": "4Jt0l3Ww9yq1a7mXf2Nn",
		"ZITADEL_PROJECT_ID":                  "399193312042352663",
		"ZITADEL_MANAGEMENT_PAT":              "pat-4Jt0l3Ww9yq1a7mXf2NnQb8Zc",
		"ZITADEL_WEBHOOK_SIGNING_KEY":         "whsec-Qp3vN8cT5yZ1mLk7",
		"REDIS_URL":                           "redis://redis:6379",
		"OBJECT_STORAGE_REGION":               "eu",
		"OBJECT_STORAGE_ENDPOINT":             "http://s3:9000",
		"OBJECT_STORAGE_ACCESS_KEY":           "rustfsadmin",
		"OBJECT_STORAGE_SECRET_KEY":           "rustfsadmin",
		"OBJECT_STORAGE_BUCKET":               "smart-novel",
		"OBJECT_STORAGE_PUBLIC_URL":           "http://s3.localhost:8080",
		"STATS_SNAPSHOT_CRON":                 "0 3 * * *",
		"FITHARA_URL":                         "http://fithara:8000",
	}
	for key, value := range overrides {
		values[key] = value
	}

	return func(key string) (string, bool) {
		value, ok := values[key]

		return value, ok
	}
}

func loadDefaults(t *testing.T) config.Config {
	t.Helper()
	cfg, err := config.Load(environment(nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	return cfg
}

func TestLoadAppliesAppDefaults(t *testing.T) {
	cfg := loadDefaults(t)

	if cfg.App.ServiceName != "smart-novel-backend" || cfg.App.Port != 3000 || cfg.App.Env != config.EnvDevelopment {
		t.Errorf("unexpected basics: %+v", cfg.App)
	}
	if got := strings.Join(cfg.App.CORSAllowedOrigins, "|"); got != "http://localhost:8080|https://novels.example.com" {
		t.Errorf("origins = %q", got)
	}
}

func TestLoadAppliesDatabaseDefaults(t *testing.T) {
	cfg := loadDefaults(t)

	if cfg.Database.URL == "" || cfg.Database.SyncSchema {
		t.Errorf("unexpected database defaults: %+v", cfg.Database)
	}
}

func TestLoadReadsZitadelSettings(t *testing.T) {
	cfg := loadDefaults(t)

	if cfg.Zitadel.IssuerURL != "http://auth.localhost:8080" || cfg.Zitadel.InternalURL != "http://traefik:80" || cfg.Zitadel.IntrospectionClientID == "" {
		t.Errorf("unexpected ZITADEL settings: %+v", cfg.Zitadel)
	}
}

func TestLoadReadsFitharaSettings(t *testing.T) {
	cfg := loadDefaults(t)
	configured, err := config.Load(environment(map[string]string{"FITHARA_TIMEOUT": "2m"}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Fithara.URL != "http://fithara:8000" || cfg.Fithara.Timeout != time.Minute {
		t.Errorf("unexpected defaults: %+v", cfg.Fithara)
	}
	if configured.Fithara.Timeout != 2*time.Minute {
		t.Errorf("timeout = %v, want 2m", configured.Fithara.Timeout)
	}
}

func TestLoadAppliesOTelDefaults(t *testing.T) {
	cfg := loadDefaults(t)

	if cfg.OTel.Enabled || cfg.OTel.BatchSize != 512 || cfg.OTel.FlushInterval != 5*time.Second || cfg.OTel.LogsExporter != config.LogsExporterStdout {
		t.Errorf("unexpected OTel defaults: %+v", cfg.OTel)
	}
}

func TestLoadReadsOTelSettings(t *testing.T) {
	lookup := environment(map[string]string{
		"OTEL_ENABLED":                 "true",
		"OTEL_EXPORTER_OTLP_ENDPOINT":  "http://otel-collector:4318",
		"OTEL_TRACES_SAMPLER_ARG":      "0.05",
		"OTEL_BATCH_FLUSH_INTERVAL_MS": "1500",
		"OTEL_LOGS_EXPORTER":           "stdout",
	})

	cfg, err := config.Load(lookup)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !cfg.OTel.Enabled || cfg.OTel.Endpoint != "http://otel-collector:4318" || cfg.OTel.TracesSamplerArg != 0.05 {
		t.Errorf("unexpected OTel: %+v", cfg.OTel)
	}
	if cfg.OTel.FlushInterval != 1500*time.Millisecond || cfg.OTel.LogsExporter != config.LogsExporterStdout {
		t.Errorf("unexpected OTel timing: %+v", cfg.OTel)
	}
}

func TestLoadAcceptsBothLogsExporters(t *testing.T) {
	for _, exporter := range []string{"otlp", "stdout"} {
		t.Run(exporter, func(t *testing.T) {
			lookup := environment(map[string]string{"OTEL_LOGS_EXPORTER": exporter})

			cfg, err := config.Load(lookup)

			if err != nil || cfg.OTel.LogsExporter != exporter {
				t.Errorf("got %q, %v", cfg.OTel.LogsExporter, err)
			}
		})
	}
}

func TestLoadRejectsBadSettings(t *testing.T) {
	cases := []struct {
		name      string
		overrides map[string]string
		wantError string
	}{
		{"missing port", map[string]string{"PORT": ""}, "PORT is required"},
		{"port out of range", map[string]string{"PORT": "70000"}, "PORT must be a port"},
		{"unknown logs exporter", map[string]string{"OTEL_LOGS_EXPORTER": "none"}, "OTEL_LOGS_EXPORTER must be one of"},
		{"unknown environment", map[string]string{"APP_ENV": "staging"}, "APP_ENV must be one of"},
		{"unknown log format", map[string]string{"LOG_FORMAT": "XML"}, "LOG_FORMAT must be one of"},
		{"unknown log level", map[string]string{"LOG_LEVEL": "http"}, "LOG_LEVEL must be debug, info, warn or error"},
		{"missing database url", map[string]string{"DATABASE_URL": ""}, "DATABASE_URL is required"},
		{"create schema is not a boolean", map[string]string{"DEV_SYNC_DATABASE_SCHEMA": "1"}, "DEV_SYNC_DATABASE_SCHEMA must be true or false"},
		{"create schema in production", map[string]string{"DEV_SYNC_DATABASE_SCHEMA": "true", "APP_ENV": "production"}, "DEV_SYNC_DATABASE_SCHEMA must not be true when APP_ENV is production"},
		{"missing issuer url", map[string]string{"ZITADEL_ISSUER_URL": ""}, "ZITADEL_ISSUER_URL is required"},
		{"missing introspection client id", map[string]string{"ZITADEL_INTROSPECTION_CLIENT_ID": ""}, "ZITADEL_INTROSPECTION_CLIENT_ID is required"},
		{"missing introspection client secret", map[string]string{"ZITADEL_INTROSPECTION_CLIENT_SECRET": ""}, "ZITADEL_INTROSPECTION_CLIENT_SECRET is required"},
		{"missing project id", map[string]string{"ZITADEL_PROJECT_ID": ""}, "ZITADEL_PROJECT_ID is required"},
		{"missing management pat", map[string]string{"ZITADEL_MANAGEMENT_PAT": ""}, "ZITADEL_MANAGEMENT_PAT is required"},
		{"missing webhook signing key", map[string]string{"ZITADEL_WEBHOOK_SIGNING_KEY": ""}, "ZITADEL_WEBHOOK_SIGNING_KEY is required"},
		{"missing bucket", map[string]string{"OBJECT_STORAGE_BUCKET": ""}, "OBJECT_STORAGE_BUCKET is required"},
		{"missing public url", map[string]string{"OBJECT_STORAGE_PUBLIC_URL": ""}, "OBJECT_STORAGE_PUBLIC_URL is required"},
		{"an access key without its secret", map[string]string{"OBJECT_STORAGE_SECRET_KEY": ""}, "must be set together"},
		{"missing redis url", map[string]string{"REDIS_URL": ""}, "REDIS_URL is required"},
		{"missing snapshot schedule", map[string]string{"STATS_SNAPSHOT_CRON": ""}, "STATS_SNAPSHOT_CRON is required"},
		{"snapshot schedule that is not cron", map[string]string{"STATS_SNAPSHOT_CRON": "every night"}, "STATS_SNAPSHOT_CRON must be a cron expression"},
		{"missing fithara url", map[string]string{"FITHARA_URL": ""}, "FITHARA_URL is required"},
		{"fithara timeout without a unit", map[string]string{"FITHARA_TIMEOUT": "60"}, "FITHARA_TIMEOUT must be a positive duration"},
		{"no origins", map[string]string{"CORS_ALLOWED_ORIGINS": " , "}, "CORS_ALLOWED_ORIGINS is required"},
		{"sampler ratio above one", map[string]string{"OTEL_TRACES_SAMPLER_ARG": "1.5"}, "OTEL_TRACES_SAMPLER_ARG must be a number"},
		{"batch size not a number", map[string]string{"OTEL_BATCH_SPANS_PER_EXPORT": "many"}, "OTEL_BATCH_SPANS_PER_EXPORT must be a positive integer"},
		{"otel enabled without endpoint", map[string]string{"OTEL_ENABLED": "true"}, "OTEL_EXPORTER_OTLP_ENDPOINT is required when OTEL_ENABLED"},
		{"otel enabled is not a boolean", map[string]string{"OTEL_ENABLED": "yes"}, "OTEL_ENABLED must be true or false"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			lookup := environment(c.overrides)

			_, err := config.Load(lookup)

			if err == nil || !strings.Contains(err.Error(), c.wantError) {
				t.Errorf("error = %v, want it to contain %q", err, c.wantError)
			}
		})
	}
}

func TestLoadReportsEveryMistakeAtOnce(t *testing.T) {
	lookup := environment(map[string]string{"PORT": "", "APP_ENV": "staging", "LOG_FORMAT": "XML"})

	_, err := config.Load(lookup)

	if err == nil {
		t.Fatal("expected an error")
	}
	for _, key := range []string{"PORT", "APP_ENV", "LOG_FORMAT"} {
		if !strings.Contains(err.Error(), key) {
			t.Errorf("error %q does not mention %s", err, key)
		}
	}
}
