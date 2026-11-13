package platformterms

import (
	"context"
	"database/sql"
	"errors"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/platformtermsacceptance"
)

// repository is the only place of this package that builds database queries. It decides nothing.
type repository struct {
	client *ent.Client
}

func newRepository(client *ent.Client) *repository {
	return &repository{client: client}
}

func (r *repository) acceptances(ctx context.Context, userID string) ([]*ent.PlatformTermsAcceptance, error) {
	return r.client.PlatformTermsAcceptance.Query().Where(platformtermsacceptance.UserID(userID)).All(ctx)
}

func (r *repository) accepted(ctx context.Context, userID string, version int) (bool, error) {
	return r.client.PlatformTermsAcceptance.Query().
		Where(platformtermsacceptance.UserID(userID), platformtermsacceptance.TermsVersion(version)).
		Exist(ctx)
}

// accept records the acceptance once; accepting again changes nothing. Ent reports a conflict that was ignored as no rows.
func (r *repository) accept(ctx context.Context, userID string, version int) error {
	err := r.client.PlatformTermsAcceptance.Create().
		SetUserID(userID).
		SetTermsVersion(version).
		OnConflictColumns(platformtermsacceptance.FieldUserID, platformtermsacceptance.FieldTermsVersion).
		DoNothing().
		Exec(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}

	return err
}
