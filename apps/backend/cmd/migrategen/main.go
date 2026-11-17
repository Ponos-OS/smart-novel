// Command migrategen writes the next versioned migration: the difference between the files in ent/migrate/migrations and the ent schema, computed on a throwaway PostgreSQL.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"

	atlas "ariga.io/atlas/sql/migrate"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql/schema"
	_ "github.com/lib/pq"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent/migrate"
)

const (
	migrationsDir = "ent/migrate/migrations"
	// postgresImage is the one the stacks run (infra/terraform/local/1-app/variables.tf). It might drift from what we have in prod env though with minor risks.
	postgresImage = "postgres:18.2-bookworm"
	// extensionsFile comes first because ent cannot express CREATE EXTENSION and the schema needs citext.
	extensionsFile = "20260101000000_extensions.sql"
	extensionsSQL  = "-- ent cannot declare extensions, so this is written by hand. The pen names and tag names are citext.\nCREATE EXTENSION IF NOT EXISTS citext;\n"
)

func main() {
	flag.Parse()
	if flag.NArg() != 1 {
		log.Fatal("usage: migrategen <name>, e.g. migrategen baseline")
	}
	if err := run(flag.Arg(0)); err != nil {
		log.Fatal(err)
	}
}

func run(name string) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	dir, err := atlas.NewLocalDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("opening %s: %w", migrationsDir, err)
	}
	if err := writeExtensions(dir); err != nil {
		return err
	}

	container, runErr := postgres.Run(ctx, postgresImage,
		postgres.WithDatabase("dev"),
		postgres.WithUsername("postgres"),
		postgres.WithPassword("postgres"),
		postgres.BasicWaitStrategies(),
	)
	if runErr != nil {
		return fmt.Errorf("starting the throwaway postgres: %w", runErr)
	}
	defer func() {
		if stopErr := testcontainers.TerminateContainer(
			container,
		); stopErr != nil {
			log.Printf("stopping the throwaway postgres: %v", stopErr)
		}
	}()
	url, urlErr := container.ConnectionString(ctx, "sslmode=disable")
	if urlErr != nil {
		return fmt.Errorf("connection string: %w", urlErr)
	}

	return migrate.NamedDiff(ctx, url, name,
		schema.WithDir(dir),
		schema.WithMigrationMode(schema.ModeReplay),
		schema.WithDialect(dialect.Postgres),
		schema.WithFormatter(atlas.DefaultFormatter),
	)
}

func writeExtensions(dir *atlas.LocalDir) error {
	if _, err := os.Stat(
		filepath.Join(migrationsDir, extensionsFile),
	); err == nil {
		return nil
	} else if !errors.Is(
		err,
		os.ErrNotExist,
	) {
		return err
	}
	if writeErr := dir.WriteFile(
		extensionsFile,
		[]byte(extensionsSQL),
	); writeErr != nil {
		return fmt.Errorf("writing %s: %w", extensionsFile, writeErr)
	}
	sum, err := dir.Checksum()
	if err != nil {
		return err
	}

	return atlas.WriteSumFile(dir, sum)
}
