package database

import (
	"context"
	"fmt"

	"go.uber.org/fx"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

func Module() fx.Option {
	return fx.Module(
		"database",
		fx.Provide(
			newDatabase,
			func(db *Database) *ent.Client { return db.Client },
		),
	)
}

func newDatabase(lc fx.Lifecycle, cfg config.Config) (*Database, error) {
	db, err := Open(context.Background(), cfg.Database.URL)
	if err != nil {
		return nil, err
	}
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			if !cfg.Database.SyncSchema {
				return nil
			}

			return db.SyncSchema(ctx)
		},
		OnStop: func(context.Context) error {
			if err := db.Close(); err != nil {
				return fmt.Errorf("closing the database: %w", err)
			}

			return nil
		},
	})

	return db, nil
}
