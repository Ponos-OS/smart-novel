package logging

import (
	"context"
	"io"
	"log/slog"

	"go.opentelemetry.io/otel/trace"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

const (
	keyService = "service"
	keyTraceID = "trace_id"
	keySpanID  = "span_id"
)

// New writes to out in the configured mode and also to shipped when it is not nil.
func New(cfg config.Config, out io.Writer, shipped slog.Handler) *slog.Logger {
	options := &slog.HandlerOptions{Level: cfg.App.LogLevel}

	var local slog.Handler = slog.NewTextHandler(out, options)
	if cfg.App.LogFormat == config.LogFormatJSON {
		local = slog.NewJSONHandler(out, options)
	}
	local = traceCorrelation{local}
	if shipped == nil {
		return slog.New(local).With(slog.String(keyService, cfg.App.ServiceName))
	}

	return slog.New(slog.NewMultiHandler(local, shipped)).With(slog.String(keyService, cfg.App.ServiceName))
}

// traceCorrelation adds the trace and span IDs of the context, so a log line can be found from its trace.
type traceCorrelation struct {
	slog.Handler
}

func (h traceCorrelation) Handle(ctx context.Context, record slog.Record) error {
	if span := trace.SpanContextFromContext(ctx); span.IsValid() {
		record.AddAttrs(
			slog.String(keyTraceID, span.TraceID().String()),
			slog.String(keySpanID, span.SpanID().String()),
		)
	}

	return h.Handler.Handle(ctx, record)
}

func (h traceCorrelation) WithAttrs(attrs []slog.Attr) slog.Handler {
	return traceCorrelation{h.Handler.WithAttrs(attrs)}
}

func (h traceCorrelation) WithGroup(name string) slog.Handler {
	return traceCorrelation{h.Handler.WithGroup(name)}
}
