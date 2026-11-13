package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/rs/cors"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel/trace"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

const (
	graphqlPath      = "/graphql"
	shutdownTimeout  = 15 * time.Second
	readHeaderTimout = 10 * time.Second
)

type Options struct {
	Config         config.Config
	Logger         *slog.Logger
	Schema         graphql.ExecutableSchema
	Verifier       auth.Verifier
	Extensions     []graphql.HandlerExtension
	TracerProvider trace.TracerProvider
}

func New(options Options) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("POST "+graphqlPath, graphqlHandler(options))
	if options.Config.App.Env != config.EnvProduction {
		mux.Handle("GET "+graphqlPath, playground.Handler("smart-novel", graphqlPath))
	}

	allowed := cors.New(cors.Options{
		AllowedOrigins:   options.Config.App.CORSAllowedOrigins,
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})
	traced := otelhttp.NewHandler( // Opens the request span & reads an incoming traceparent
		traceIDHeader( // Copies the active trace ID into the x-trace-id response header.
			recoverPanics( // Catches a panic and logs it.
				options.Logger,
				accessLog(
					options.Logger,
					allowed.Handler(
						auth.Middleware(options.Verifier, options.Logger)(mux),
					),
				),
			),
		),
		"http",
		otelhttp.WithTracerProvider(tracerProvider(options.TracerProvider)),
		otelhttp.WithSpanNameFormatter(formatSpanName),
	)

	return withSpanName(traced)
}

func graphqlHandler(options Options) http.Handler {
	srv := handler.New(options.Schema)
	srv.AddTransport(transport.POST{})
	srv.SetErrorPresenter(errorPresenter(options.Logger))
	srv.Use(operationSpan{})
	srv.AroundFields(auth.Guard())
	srv.AroundFields(rejectNUL)
	for _, custom := range options.Extensions {
		srv.Use(custom)
	}
	srv.Use(depthLimit{limit: maxQueryDepth})
	if options.Config.App.Env != config.EnvProduction {
		srv.Use(extension.Introspection{})
	}

	return srv
}

// Serve blocks until ctx is cancelled, then stops accepting requests and lets the running ones finish.
func Serve(ctx context.Context, logger *slog.Logger, port int, root http.Handler) error {
	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", port),
		Handler:           root,
		ReadHeaderTimeout: readHeaderTimout,
	}
	failed := make(chan error, 1)
	go func() {
		logger.InfoContext(ctx, "server listening", slog.String(logKeyAddr, srv.Addr))
		failed <- srv.ListenAndServe()
	}()

	select {
	case err := <-failed:
		return err
	case <-ctx.Done():
	}

	logger.InfoContext(ctx, "server shutting down")
	stopCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(stopCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("graceful shutdown: %w", err)
	}

	return nil
}
