// Command devdata fills the database of the local stack and the e2e tests with demo data; see internal/devdata.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/devdata"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/database"
)

var (
	errProduction     = errors.New("devdata is for development and e2e only")
	errNoDatabaseURL  = errors.New("DATABASE_URL is not set")
	errNoWriterUserID = errors.New("ZITADEL_WRITER_USER_ID is not set")
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	if os.Getenv("APP_ENV") == "production" {
		return errProduction
	}
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return errNoDatabaseURL
	}
	writers, err := devdata.ParseWriters(os.Getenv("SEEDED_WRITERS"))
	if err != nil {
		return err
	}
	novelWriter := os.Getenv("ZITADEL_WRITER_USER_ID")
	if novelWriter == "" {
		return errNoWriterUserID
	}
	dataPath := os.Getenv("DATA_PATH")
	if dataPath == "" {
		dataPath = "/data"
	}

	ctx, stop := signal.NotifyContext(
		context.Background(),
		syscall.SIGINT,
		syscall.SIGTERM,
	)
	defer stop()
	db, err := database.Open(ctx, databaseURL)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := db.Close(); closeErr != nil {
			fmt.Fprintln(os.Stderr, "closing the database:", closeErr)
		}
	}()
	if err := db.SyncSchema(ctx); err != nil {
		return err
	}

	return devdata.Run(ctx, db.Client, devdata.Options{
		DataPath:          dataPath,
		Writers:           writers,
		NovelWriterUserID: novelWriter,
		Logger:            slog.New(slog.NewTextHandler(os.Stdout, nil)),
	})
}
