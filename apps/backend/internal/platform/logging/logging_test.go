package logging_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"

	"go.opentelemetry.io/otel/trace"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/logging"
)

func TestNewHonoursLevelAndMode(t *testing.T) {
	cases := []struct {
		name    string
		level   slog.Level
		format  string
		logged  bool
		wantKey string
	}{
		{
			"debug hidden at info",
			slog.LevelInfo,
			config.LogFormatJSON,
			false,
			"",
		},
		{
			"info shown at info",
			slog.LevelInfo,
			config.LogFormatJSON,
			true,
			`"msg":"listening"`,
		},
		{
			"debug shown at debug",
			slog.LevelDebug,
			config.LogFormatJSON,
			true,
			`"msg":"details"`,
		},
		{
			"text format",
			slog.LevelInfo,
			config.LogFormatText,
			true,
			"msg=listening",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var out bytes.Buffer
			cfg := config.Config{
				App: config.App{
					ServiceName: "smart-novel-backend",
					LogLevel:    c.level,
					LogFormat:   c.format,
				},
			}
			logger := logging.New(cfg, &out, nil)

			logger.DebugContext(t.Context(), "details")
			logger.InfoContext(t.Context(), "listening")

			if got := strings.Contains(
				out.String(),
				c.wantKey,
			); c.logged &&
				!got {
				t.Errorf(
					"output %q does not contain %q",
					out.String(),
					c.wantKey,
				)
			}
			if !c.logged && strings.Contains(out.String(), "details") {
				t.Errorf("debug line leaked: %q", out.String())
			}
		})
	}
}

func TestNewAddsTraceIDsFromTheContext(t *testing.T) {
	var out bytes.Buffer
	cfg := config.Config{
		App: config.App{
			ServiceName: "smart-novel-backend",
			LogLevel:    slog.LevelInfo,
			LogFormat:   config.LogFormatJSON,
		},
	}
	logger := logging.New(cfg, &out, nil)
	traceID, err := trace.TraceIDFromHex("4bf92f3577b34da6a3ce929d0e0e4736")
	if err != nil {
		t.Fatal(err)
	}
	spanID, err := trace.SpanIDFromHex("00f067aa0ba902b7")
	if err != nil {
		t.Fatal(err)
	}
	ctx := trace.ContextWithSpanContext(
		context.Background(),
		trace.NewSpanContext(trace.SpanContextConfig{
			TraceID: traceID, SpanID: spanID, TraceFlags: trace.FlagsSampled,
		}),
	)

	logger.InfoContext(ctx, "request done")

	var line map[string]any
	if err := json.Unmarshal(out.Bytes(), &line); err != nil {
		t.Fatalf("not JSON: %v", err)
	}
	if line["trace_id"] != "4bf92f3577b34da6a3ce929d0e0e4736" ||
		line["span_id"] != "00f067aa0ba902b7" {
		t.Errorf("missing trace correlation: %v", line)
	}
}

func TestNewAlsoWritesToTheShippedHandler(t *testing.T) {
	var local, shipped bytes.Buffer
	cfg := config.Config{
		App: config.App{
			ServiceName: "smart-novel-backend",
			LogLevel:    slog.LevelInfo,
			LogFormat:   config.LogFormatJSON,
		},
	}
	logger := logging.New(cfg, &local, slog.NewJSONHandler(&shipped, nil))

	logger.InfoContext(t.Context(), "server started")

	if !strings.Contains(local.String(), "server started") ||
		!strings.Contains(shipped.String(), "server started") {
		t.Errorf("local=%q shipped=%q", local.String(), shipped.String())
	}
}
