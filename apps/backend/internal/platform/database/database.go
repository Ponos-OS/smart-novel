package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	// Registers the "pgx" driver of database/sql.
	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
)

var errNoRowEstimate = errors.New("the query plan has no row estimate")

// Database owns the connection pool and the ent client built on it.
type Database struct {
	Client *ent.Client
	db     *sql.DB
}

func Open(ctx context.Context, url string) (*Database, error) {
	db, err := sql.Open("pgx", url)
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf(
			"reaching database: %w",
			errors.Join(err, db.Close()),
		)
	}

	return &Database{
		Client: ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, db))),
		db:     db,
	}, nil
}

func (d *Database) Close() error {
	return d.Client.Close()
}

// Exec runs raw SQL, for tests and for tools that apply migration files.
func (d *Database) Exec(
	ctx context.Context,
	statements string,
) (sql.Result, error) {
	return d.db.ExecContext(ctx, statements)
}

// SyncSchema brings the tables up to date with the ent schema, the way dev and e2e do. Production applies the versioned migrations instead.
func (d *Database) SyncSchema(ctx context.Context) error {
	if _, err := d.db.ExecContext(
		ctx,
		`CREATE EXTENSION IF NOT EXISTS citext`,
	); err != nil {
		return fmt.Errorf("creating the citext extension: %w", err)
	}
	if err := d.Client.Schema.Create(ctx); err != nil {
		return fmt.Errorf("creating the schema: %w", err)
	}

	return nil
}

// EstimateRows returns the planner's row estimate for query instead of running it. EXPLAIN only plans, so its cost stays flat however many rows match, while counting visits every one. The price is accuracy: the estimate is as fresh as the table statistics (ANALYZE), and the planner never goes below 1.
func (d *Database) EstimateRows(
	ctx context.Context,
	query string,
	args ...any,
) (int, error) {
	var plan []byte
	if err := d.db.QueryRowContext(ctx, "EXPLAIN (FORMAT JSON) "+query, args...).
		Scan(&plan); err != nil {
		return 0, fmt.Errorf("explaining the query: %w", err)
	}

	var parsed []struct {
		Plan struct {
			PlanRows float64 `json:"Plan Rows"`
		} `json:"Plan"`
	}
	if err := json.Unmarshal(plan, &parsed); err != nil || len(parsed) == 0 {
		return 0, errNoRowEstimate
	}

	return max(0, int(math.Round(parsed[0].Plan.PlanRows))), nil
}
