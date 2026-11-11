package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/logging"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/telemetry"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/server"
)

const telemetryFlushTimeout = 10 * time.Second

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

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
		if err := sdk.Shutdown(flushCtx); err != nil {
			fmt.Fprintln(os.Stderr, "telemetry shutdown:", err)
		}
	}()

	logger := logging.New(cfg, os.Stdout, sdk.LogHandler())
	handler := server.New(server.Options{
		Config: cfg,
		Logger: logger,
		Schema: graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{}}),
	})

	return server.Serve(ctx, logger, cfg.App.Port, handler)
}
