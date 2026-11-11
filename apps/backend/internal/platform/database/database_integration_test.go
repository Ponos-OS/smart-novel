//go:build integration

package database_test

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/platform/database"
)

const (
	migrationsDir = "../../../ent/migrate/migrations"
	// postgresImage is the one the stacks run (infra/terraform/local/1-app/variables.tf).
	postgresImage = "postgres:18.2-bookworm"
)

// Production applies the files in ent/migrate/migrations while dev and e2e sync the tables from the ent schema, so nothing else notices a schema change that has no migration.
func TestVersionedMigrationsMatchTheSchema(t *testing.T) {
	ctx := context.Background()
	container, err := postgres.Run(ctx, postgresImage, postgres.BasicWaitStrategies())
	if err != nil {
		t.Fatalf("starting postgres: %v", err)
	}
	t.Cleanup(func() {
		if stopErr := testcontainers.TerminateContainer(container); stopErr != nil {
			t.Errorf("stopping postgres: %v", stopErr)
		}
	})
	url, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	db, err := database.Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := db.Close(); closeErr != nil {
			t.Errorf("closing: %v", closeErr)
		}
	})
	applyMigrations(t, db)
	var pending bytes.Buffer

	err = db.Client.Schema.WriteTo(ctx, &pending)
	if err != nil {
		t.Fatal(err)
	}
	if got := strings.TrimSpace(pending.String()); got != "" {
		t.Errorf("the migrations leave the database behind the ent schema; generate a new migration:\n%s", got)
	}
}

func applyMigrations(t *testing.T, db *database.Database) {
	t.Helper()
	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.sql"))
	if err != nil || len(files) == 0 {
		t.Fatalf("no migrations found: %v", err)
	}
	for _, file := range files {
		statements, readErr := os.ReadFile(file)
		if readErr != nil {
			t.Fatal(readErr)
		}
		if _, execErr := db.Exec(context.Background(), string(statements)); execErr != nil {
			t.Fatalf("applying %s: %v", filepath.Base(file), execErr)
		}
	}
}
