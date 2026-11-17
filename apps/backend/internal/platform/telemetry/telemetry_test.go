package telemetry_test

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"go.opentelemetry.io/otel"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/telemetry"
)

type collector struct {
	mu    sync.Mutex
	paths map[string]int
}

func (c *collector) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	c.mu.Lock()
	c.paths[r.URL.Path]++
	c.mu.Unlock()
	w.WriteHeader(http.StatusOK)
}

func (c *collector) count(path string) int {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.paths[path]
}

func settings(endpoint, logsExporter string) config.Config {
	return config.Config{
		App: config.App{
			ServiceName: "smart-novel-backend",
			Env:         config.EnvTest,
		},
		OTel: config.OTel{
			Enabled:          true,
			Endpoint:         endpoint,
			TracesSampler:    "always_on",
			TracesSamplerArg: 1,
			MaxQueueSize:     16,
			BatchSize:        4,
			FlushInterval:    20 * time.Millisecond,
			ExportTimeout:    time.Second,
			LogsExporter:     logsExporter,
		},
	}
}

func TestStartDoesNothingWhenDisabled(t *testing.T) {
	cfg := config.Config{}

	started, err := telemetry.Start(context.Background(), cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if started.LogHandler() != nil {
		t.Error("a disabled SDK must not ship logs")
	}
	if err := started.Shutdown(context.Background()); err != nil {
		t.Errorf("shutdown: %v", err)
	}
}

func TestStartShipsSpansAndLogsToTheCollector(t *testing.T) {
	received := &collector{paths: map[string]int{}}
	server := httptest.NewServer(received)
	t.Cleanup(server.Close)
	cfg := settings(server.URL, config.LogsExporterOTLP)

	started, err := telemetry.Start(context.Background(), cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_, span := otel.Tracer("test").Start(context.Background(), "request")
	span.End()
	handler := started.LogHandler()
	if handler == nil {
		t.Fatal("expected a log handler for OTEL_LOGS_EXPORTER=otlp")
	}
	slog.New(handler).InfoContext(context.Background(), "server started")

	if err := started.Shutdown(context.Background()); err != nil {
		t.Fatalf("shutdown: %v", err)
	}

	if received.count("/v1/traces") == 0 {
		t.Error("no trace export reached the collector")
	}
	if received.count("/v1/logs") == 0 {
		t.Error("no log export reached the collector")
	}
}

func TestStartKeepsLogsOnStdoutWhenConfigured(t *testing.T) {
	server := httptest.NewServer(&collector{paths: map[string]int{}})
	t.Cleanup(server.Close)
	cfg := settings(server.URL, config.LogsExporterStdout)

	started, err := telemetry.Start(context.Background(), cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	t.Cleanup(func() {
		if err := started.Shutdown(context.Background()); err != nil {
			t.Errorf("shutdown: %v", err)
		}
	})
	if started.LogHandler() != nil {
		t.Error("logs must stay on stdout")
	}
}
