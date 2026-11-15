package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/99designs/gqlgen/graphql"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/fithara"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/database"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/logging"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/telemetry"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/zitadel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platformterms"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/stats"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/writer"
)

const telemetryFlushTimeout = 10 * time.Second

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

const logKeyError = "error"

func run() error {
	cfg, err := config.Load(os.LookupEnv)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	sdk, err := telemetry.Start(ctx, cfg)
	if err != nil {
		return err
	}
	defer func() {
		flushCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), telemetryFlushTimeout)
		defer cancel()
		if shutdownErr := sdk.Shutdown(flushCtx); shutdownErr != nil {
			fmt.Fprintln(os.Stderr, "telemetry shutdown:", shutdownErr)
		}
	}()

	logger := logging.New(cfg, os.Stdout, sdk.LogHandler())

	db, err := database.Open(ctx, cfg.Database.URL)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := db.Close(); closeErr != nil {
			logger.ErrorContext(ctx, "closing the database", slog.Any(logKeyError, closeErr))
		}
	}()
	if cfg.Database.SyncSchema {
		if schemaErr := db.SyncSchema(ctx); schemaErr != nil {
			return schemaErr
		}
	}

	handler, err := newHandler(ctx, cfg, db, logger)
	if err != nil {
		return err
	}

	return server.Serve(ctx, logger, cfg.App.Port, handler)
}

func newHandler(ctx context.Context, cfg config.Config, db *database.Database, logger *slog.Logger) (http.Handler, error) {
	verifier, err := auth.NewZitadelVerifier(ctx, auth.ZitadelConfig{
		IssuerURL:    cfg.Zitadel.IssuerURL,
		InternalURL:  cfg.Zitadel.InternalURL,
		ClientID:     cfg.Zitadel.IntrospectionClientID,
		ClientSecret: cfg.Zitadel.IntrospectionClientSecret,
	})
	if err != nil {
		return nil, err
	}

	resolver, err := newResolver(ctx, cfg, db, logger)
	if err != nil {
		return nil, err
	}

	return server.New(server.Options{
		Config: cfg,
		Logger: logger,
		Schema: graph.NewExecutableSchema(graph.Config{
			Resolvers:  resolver,
			Directives: graph.Directives(),
		}),
		Verifier:   verifier,
		Terms:      resolver.TermsService,
		Extensions: []graphql.HandlerExtension{graph.NewLoaderExtension(db.Client, resolver.ChapterService)},
	}), nil
}

func newResolver(ctx context.Context, cfg config.Config, db *database.Database, logger *slog.Logger) (*graph.Resolver, error) {
	management, err := zitadel.NewManagement(ctx, cfg.Zitadel)
	if err != nil {
		return nil, err
	}
	terms, err := platformterms.Current()
	if err != nil {
		return nil, err
	}

	fitharaClient, err := fithara.NewClientWithResponses(cfg.Fithara.URL, fithara.WithHTTPClient(&http.Client{Timeout: cfg.Fithara.Timeout}))
	if err != nil {
		return nil, fmt.Errorf("creating the Fithara client: %w", err)
	}
	licenseService := license.NewService(db.Client, fitharaClient, logger)
	if _, err := licenseService.EnsureDefault(ctx); err != nil {
		return nil, err
	}

	return &graph.Resolver{
		Client:         db.Client,
		Logger:         logger,
		TagService:     tag.NewService(db.Client, db),
		NovelService:   novel.NewService(db.Client, db, licenseService),
		LicenseService: licenseService,
		ChapterService: chapter.NewService(db.Client),
		StatsService:   stats.NewService(db, logger),
		WriterService:  writer.NewService(db.Client, management),
		TermsService:   platformterms.NewService(db.Client, terms),
	}, nil
}
