// Package entx has the helpers that go with the ent client.
package entx

import (
	"context"
	"errors"
	"fmt"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
)

// WithTx runs work in a transaction: it commits when work succeeds and rolls back when it fails or panics.
func WithTx(
	ctx context.Context,
	client *ent.Client,
	work func(*ent.Tx) error,
) error {
	tx, err := client.Tx(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if recovered := recover(); recovered != nil {
			panic(
				errors.Join(
					fmt.Errorf( //nolint:err113 // carries the panic value
						"panic in a transaction: %v",
						recovered,
					),
					tx.Rollback(),
				),
			)
		}
	}()
	if err := work(tx); err != nil {
		return errors.Join(err, tx.Rollback())
	}

	return tx.Commit()
}
