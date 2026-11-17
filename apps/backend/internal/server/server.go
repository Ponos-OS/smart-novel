package server

import (
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	coderws "github.com/coder/websocket"
	"github.com/rs/cors"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platformterms"
)

const (
	graphqlPath      = "/graphql"
	readHeaderTimout = 10 * time.Second
	websocketPing    = 10 * time.Second
)

type Options struct {
	Config         config.Config
	Logger         *slog.Logger
	Schema         graphql.ExecutableSchema
	Verifier       auth.Verifier
	Extensions     []graphql.HandlerExtension
	TracerProvider trace.TracerProvider
	// Propagator reads an incoming traceparent; none means requests start their own trace.
	Propagator propagation.TextMapPropagator
	Terms      platformterms.Acceptances
	// Routes are the endpoints other services call, by "METHOD /path". Each checks its own caller, so none needs a viewer.
	Routes map[string]http.Handler
}

func New(options Options) http.Handler {
	mux := http.NewServeMux()
	for pattern, route := range options.Routes {
		mux.Handle(pattern, route)
	}
	graphqlOverHTTP := graphqlHandler(options)
	mux.Handle("POST "+graphqlPath, graphqlOverHTTP)
	mux.Handle(
		"GET "+graphqlPath,
		upgradedOr(graphqlOverHTTP, playgroundHandler(options.Config)),
	)

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
		otelhttp.WithPropagators(propagator(options.Propagator)),
		otelhttp.WithSpanNameFormatter(formatSpanName),
	)

	return withSpanName(traced)
}

// playgroundHandler is the page for a browser outside production, and what a GET gets in production: nothing, as before subscriptions.
func playgroundHandler(cfg config.Config) http.Handler {
	if cfg.App.Env != config.EnvProduction {
		return playground.Handler("smart-novel", graphqlPath)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	})
}

// upgradedOr gives the websocket handshakes of subscriptions to socket and every other GET to other.
func upgradedOr(socket, other http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Upgrade") != "" {
			socket.ServeHTTP(w, r)

			return
		}
		other.ServeHTTP(w, r)
	})
}

// originHosts are the hosts a browser may open a websocket from: the ones that may call the API.
func originHosts(origins []string) []string {
	hosts := make([]string, 0, len(origins))
	for _, origin := range origins {
		if parsed, err := url.Parse(origin); err == nil && parsed.Host != "" {
			hosts = append(hosts, parsed.Host)
		}
	}

	return hosts
}

func graphqlHandler(options Options) http.Handler {
	srv := handler.New(options.Schema)
	srv.AddTransport(transport.POST{})
	srv.AddTransport(transport.Websocket{
		KeepAlivePingInterval: websocketPing,
		Implementation: transport.CoderWebsocketImplementation{
			AcceptOptions: coderws.AcceptOptions{
				OriginPatterns: originHosts(
					options.Config.App.CORSAllowedOrigins,
				),
			},
		},
	})
	srv.SetErrorPresenter(errorPresenter(options.Logger))
	srv.Use(operationSpan{})
	srv.AroundFields(auth.Guard())
	srv.AroundFields(platformterms.Guard(options.Terms))
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
