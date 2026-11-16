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
	genqlient "github.com/Khan/genqlient/graphql"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/beatrice"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/fithara"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/llm"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/narration"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/node"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/database"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/logging"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/objectstorage"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/redis"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/telemetry"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/zitadel"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platformterms"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/stats"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/ttscallbacks"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/writer"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/zitadelevents"
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

	cache, err := redis.Open(ctx, cfg.Redis, logger)
	if err != nil {
		return err
	}
	defer cache.Close(context.WithoutCancel(ctx))

	handler, err := newHandler(ctx, cfg, db, cache, logger)
	if err != nil {
		return err
	}

	return server.Serve(ctx, logger, cfg.App.Port, handler)
}

func zitadelConfig(cfg config.Config) auth.ZitadelConfig {
	return auth.ZitadelConfig{
		IssuerURL:    cfg.Zitadel.IssuerURL,
		InternalURL:  cfg.Zitadel.InternalURL,
		ClientID:     cfg.Zitadel.IntrospectionClientID,
		ClientSecret: cfg.Zitadel.IntrospectionClientSecret,
	}
}

func newHandler(ctx context.Context, cfg config.Config, db *database.Database, cache *redis.Client, logger *slog.Logger) (http.Handler, error) {
	verifier, err := auth.NewZitadelVerifier(ctx, zitadelConfig(cfg))
	if err != nil {
		return nil, err
	}

	storage, err := objectstorage.Open(ctx, cfg.Storage)
	if err != nil {
		return nil, err
	}
	issuerCheck, err := auth.NewIssuerCheck(ctx, zitadelConfig(cfg))
	if err != nil {
		return nil, err
	}
	resolver, err := newResolver(ctx, cfg, db, cache, storage, logger)
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
		Verifier: verifier,
		Terms:    resolver.TermsService,
		Routes: map[string]http.Handler{
			"POST /zitadel-events/user-added":         zitadelevents.UserAdded(cfg.Zitadel.WebhookSigningKey, resolver.Management, logger),
			"POST /beatrice-callbacks/gen-upload-url": ttscallbacks.GenUploadURL(issuerCheck, storage, logger),
			"POST /beatrice-callbacks/status":         ttscallbacks.Status(resolver.NarrationService.Handle, logger),
		},
		Extensions: []graphql.HandlerExtension{graph.NewLoaderExtension(db.Client, resolver.ChapterService)},
	}), nil
}

func newResolver(ctx context.Context, cfg config.Config, db *database.Database, cache *redis.Client, storage *objectstorage.Client, logger *slog.Logger) (*graph.Resolver, error) {
	management, err := zitadel.NewManagement(ctx, cfg.Zitadel)
	if err != nil {
		return nil, err
	}
	terms, err := platformterms.Current()
	if err != nil {
		return nil, err
	}

	fitharaClient, err := fithara.NewClientWithResponses(cfg.Fithara.URL, fithara.WithHTTPClient(&http.Client{Timeout: cfg.Fithara.Timeout, Transport: otelhttp.NewTransport(http.DefaultTransport)}))
	if err != nil {
		return nil, fmt.Errorf("creating the Fithara client: %w", err)
	}
	licenseService := license.NewService(db.Client, fitharaClient, logger)
	if _, err = licenseService.EnsureDefault(ctx); err != nil {
		return nil, err
	}
	go licenseService.KeepCanonicalSynced(ctx)

	beatriceClient := genqlient.NewClient(cfg.Beatrice.URL, beatrice.HTTPClient{HTTP: &http.Client{Timeout: cfg.Beatrice.Timeout, Transport: otelhttp.NewTransport(http.DefaultTransport)}})
	narrationService := narration.NewService(db.Client, cache, storage, beatriceClient, cfg.Beatrice.DefaultVoice, cfg.App.InternalURL, logger)
	go narrationService.KeepListening(ctx)
	llmService := llm.NewService(beatriceClient, cache, cfg.Beatrice.ExplanationTTL, logger)
	statsService := stats.NewService(db, db.Client, logger)
	go statsService.KeepSnapshotted(ctx, cfg.Stats.SnapshotSchedule)

	return &graph.Resolver{
		Client:           db.Client,
		Logger:           logger,
		TagService:       tag.NewService(db.Client, db),
		NovelService:     novel.NewService(db.Client, db, licenseService, storage, narrationService, logger),
		LicenseService:   licenseService,
		ChapterService:   chapter.NewService(db.Client, narrationService, logger),
		NarrationService: narrationService,
		StatsService:     statsService,
		LLMService:       llmService,
		WriterService:    writer.NewService(db.Client, management),
		Management:       management,
		NodeService:      node.NewService(db.Client),
		TermsService:     platformterms.NewService(db.Client, terms, cache, logger),
	}, nil
}
