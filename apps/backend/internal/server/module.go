package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"

	"github.com/99designs/gqlgen/graphql"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platformterms"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server/route"
)

const extensionsGroup = `group:"graphql_extensions"`

// AsExtension makes a constructor of a GraphQL extension one the GraphQL handler uses.
func AsExtension(constructor any) any {
	return fx.Annotate(
		constructor,
		fx.As(new(graphql.HandlerExtension)),
		fx.ResultTags(extensionsGroup),
	)
}

var Module = fx.Module(
	"server",
	fx.Provide(newHandler),
	fx.Invoke(listen),
)

type handlerParams struct {
	fx.In

	Config         config.Config
	Logger         *slog.Logger
	Schema         graphql.ExecutableSchema
	Verifier       auth.Verifier
	Terms          platformterms.Acceptances
	TracerProvider trace.TracerProvider
	Propagator     propagation.TextMapPropagator
	Routes         []route.Route              `group:"routes"`
	Extensions     []graphql.HandlerExtension `group:"graphql_extensions"`
}

func newHandler(p handlerParams) http.Handler {
	routes := make(map[string]http.Handler, len(p.Routes))
	for _, served := range p.Routes {
		routes[served.Pattern] = served.Handler
	}

	return New(Options{
		Config:         p.Config,
		Logger:         p.Logger,
		Schema:         p.Schema,
		Verifier:       p.Verifier,
		Extensions:     p.Extensions,
		TracerProvider: p.TracerProvider,
		Propagator:     p.Propagator,
		Terms:          p.Terms,
		Routes:         routes,
	})
}

// listen serves until the application stops, then lets the running requests finish. A server that dies on its own stops the application.
func listen(
	lc fx.Lifecycle,
	shutdowner fx.Shutdowner,
	cfg config.Config,
	logger *slog.Logger,
	root http.Handler,
) {
	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.App.Port),
		Handler:           root,
		ReadHeaderTimeout: readHeaderTimout,
	}
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			listener, err := new(net.ListenConfig).Listen(ctx, "tcp", srv.Addr)
			if err != nil {
				return fmt.Errorf("listening on %s: %w", srv.Addr, err)
			}
			go func() {
				logger.InfoContext(
					ctx,
					"server listening",
					slog.String(logKeyAddr, srv.Addr),
				)
				err := srv.Serve(listener)
				if err == nil || errors.Is(err, http.ErrServerClosed) {
					return
				}
				logger.ErrorContext(
					context.WithoutCancel(ctx),
					"server failed",
					slog.Any(logKeyError, err),
				)
				if err := shutdowner.Shutdown(fx.ExitCode(1)); err != nil {
					logger.ErrorContext(
						context.WithoutCancel(ctx),
						"stopping after the server failed",
						slog.Any(logKeyError, err),
					)
				}
			}()

			return nil
		},
		OnStop: func(ctx context.Context) error {
			logger.InfoContext(ctx, "server shutting down")
			if err := srv.Shutdown(ctx); err != nil &&
				!errors.Is(err, http.ErrServerClosed) {
				return fmt.Errorf("graceful shutdown: %w", err)
			}

			return nil
		},
	})
}
