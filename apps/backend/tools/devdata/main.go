// Command devdata fills the database of the local stack and the e2e tests with demo data; see internal/devdata.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/devdata"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/database"
)

var (
	errProduction    = errors.New("devdata is for development and e2e only")
	errNoDatabaseURL = errors.New("DATABASE_URL is not set")
)

const defaultSeed uint64 = 20260101

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if os.Getenv("APP_ENV") == "production" {
		return errProduction
	}
	bulk, err := parseBulk(args)
	if err != nil {
		return err
	}
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return errNoDatabaseURL
	}
	writers, err := devdata.ParseWriters(os.Getenv("SEEDED_WRITERS"))
	if err != nil {
		return err
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
		Novels: generate(generateConfig{
			Seed:             bulk.seed,
			Novels:           bulk.novels,
			ChaptersPerNovel: bulk.chapters,
		}),
		Writers: writers,
		Logger:  slog.New(slog.NewTextHandler(os.Stdout, nil)),
	})
}

type bulkFlags struct {
	novels, chapters int
	seed             uint64
}

func parseBulk(args []string) (bulkFlags, error) {
	var bulk bulkFlags
	flags := flag.NewFlagSet("devdata", flag.ContinueOnError)
	flags.IntVar(
		&bulk.novels,
		"novels-count",
		envInt("DEVDATA_NOVELS_COUNT", 0),
		"generated novels (env DEVDATA_NOVELS_COUNT); none by default",
	)
	flags.IntVar(
		&bulk.chapters,
		"chapters-count-per-novel",
		envInt("DEVDATA_CHAPTERS_COUNT_PER_NOVEL", 0),
		"chapters of each generated novel (env DEVDATA_CHAPTERS_COUNT_PER_NOVEL)",
	)
	flags.Uint64Var(
		&bulk.seed,
		"randomizer-seed-number",
		envUint("DEVDATA_RANDOMIZER_SEED_NUMBER", defaultSeed),
		"seed of the generated data to ensure randomness (env DEVDATA_RANDOMIZER_SEED_NUMBER)",
	)

	return bulk, flags.Parse(args)
}

func envUint(name string, fallback uint64) uint64 {
	value, err := strconv.ParseUint(os.Getenv(name), 10, 64)
	if err != nil {
		return fallback
	}

	return value
}

func envInt(name string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(name))
	if err != nil {
		return fallback
	}

	return value
}
