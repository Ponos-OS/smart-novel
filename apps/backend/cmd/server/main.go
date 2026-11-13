package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/99designs/gqlgen/graphql"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/database"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/logging"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/telemetry"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/stats"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/tag"
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

	verifier, err := auth.NewZitadelVerifier(ctx, auth.ZitadelConfig{
		IssuerURL:    cfg.Zitadel.IssuerURL,
		InternalURL:  cfg.Zitadel.InternalURL,
		ClientID:     cfg.Zitadel.IntrospectionClientID,
		ClientSecret: cfg.Zitadel.IntrospectionClientSecret,
	})
	if err != nil {
		return err
	}

	resolver := newResolver(db, logger)
	handler := server.New(server.Options{
		Config: cfg,
		Logger: logger,
		Schema: graph.NewExecutableSchema(graph.Config{
			Resolvers:  resolver,
			Directives: graph.Directives(),
		}),
		Verifier:   verifier,
		Extensions: []graphql.HandlerExtension{graph.NewLoaderExtension(db.Client, resolver.ChapterService)},
	})

	return server.Serve(ctx, logger, cfg.App.Port, handler)
}

func newResolver(db *database.Database, logger *slog.Logger) *graph.Resolver {
	return &graph.Resolver{
		Client:         db.Client,
		Logger:         logger,
		TagService:     tag.NewService(db.Client, db),
		NovelService:   novel.NewService(db.Client, db),
		ChapterService: chapter.NewService(db.Client),
		StatsService:   stats.NewService(db, logger),
	}
}
