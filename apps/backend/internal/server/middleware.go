package server

import (
	"errors"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

func tracerProvider(provider trace.TracerProvider) trace.TracerProvider {
	if provider != nil {
		return provider
	}

	return otel.GetTracerProvider()
}

// traceIDHeader exposes the active trace ID as x-trace-id, separate from the traceparent header services use between themselves.
func traceIDHeader(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if span := trace.SpanContextFromContext(r.Context()); span.IsValid() {
			w.Header().Set("x-trace-id", span.TraceID().String())
		}
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(status int) {
	s.status = status
	s.ResponseWriter.WriteHeader(status)
}

func accessLog(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(recorder, r)

		logger.InfoContext(r.Context(), "request",
			slog.String(logKeyMethod, r.Method),
			slog.String(logKeyPath, r.URL.Path),
			slog.Int(logKeyStatus, recorder.status),
			slog.Int64(logKeyDurationMS, time.Since(started).Milliseconds()),
		)
	})
}

func recoverPanics(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				respondToPanic(logger, w, r, recovered)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func respondToPanic(logger *slog.Logger, w http.ResponseWriter, r *http.Request, recovered any) {
	if err, ok := recovered.(error); ok && errors.Is(err, http.ErrAbortHandler) {
		panic(recovered)
	}
	logger.ErrorContext(r.Context(), "panic in request",
		slog.Any(logKeyPanic, recovered),
		slog.String(logKeyStack, string(debug.Stack())),
	)
	http.Error(w, "internal server error", http.StatusInternalServerError)
}
