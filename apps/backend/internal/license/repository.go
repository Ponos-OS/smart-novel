package license

import (
	"context"
	stdsql "database/sql"
	"errors"

	"entgo.io/ent/dialect/sql"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
)

// repository is the only place of this package that builds database queries. It decides nothing, and the errors it returns are the
// database's own. Inside a transaction it is made from the transaction's client: newRepository(tx.Client()).
type repository struct {
	client *ent.Client
}

func newRepository(client *ent.Client) *repository {
	return &repository{client: client}
}

// stored is a license with its text hash, which a draft does not have.
type stored struct {
	Name        string
	Text        string
	TextHash    string
	OwnerID     string
	SourceType  entlicense.SourceType
	CanonicalID *string
	// Version is the edition of a license a writer or an admin made; a canonical license has the registry's version in Metadata.
	Version string
	// Metadata is what the registry says about a canonical license; nil for any other.
	Metadata *canonicalMetadata
}

type canonicalMetadata struct {
	Version     string
	OfficialURL string
}

func (r *repository) defaultLicense(ctx context.Context) (*ent.License, error) {
	return r.client.License.Query().Where(entlicense.IsDefault(true), entlicense.IsDraft(false)).Only(ctx)
}

// usable finds a finished license owned by one of owners.
func (r *repository) usable(ctx context.Context, id uuid.UUID, owners []string) (*ent.License, error) {
	return r.client.License.Query().Where(entlicense.ID(id), entlicense.IsDraft(false), entlicense.OwnerIDIn(owners...)).Only(ctx)
}

func (r *repository) byText(ctx context.Context, ownerID, textHash string) (*ent.License, error) {
	return r.client.License.Query().Where(entlicense.OwnerID(ownerID), entlicense.TextHash(textHash)).Only(ctx)
}

func (r *repository) insert(ctx context.Context, data stored) (*ent.License, error) {
	return r.newLicense(data).Save(ctx)
}

func (r *repository) newLicense(data stored) *ent.LicenseCreate {
	create := r.client.License.Create().
		SetName(data.Name).
		SetText(data.Text).
		SetTextHash(data.TextHash).
		SetOwnerID(data.OwnerID).
		SetSourceType(data.SourceType).
		SetNillableCanonicalID(data.CanonicalID)
	if m := data.Metadata; m != nil {
		create.SetVersion(m.Version).SetOfficialURL(m.OfficialURL)
	}
	if data.Version != "" {
		create.SetVersion(data.Version)
	}

	return create
}

// upsertCanonical stores a canonical license, or makes the stored one with the same registry ID what the registry says now, its text too. It is one statement, so replicas that run it together queue on the row. The row is written only when something differs, or every round would move every canonical license to the top of the list ordered by update time. ent's upsert cannot express that comparison, so the condition is SQL, and the predicate of the partial index is written as the index has it.
func (r *repository) upsertCanonical(ctx context.Context, data stored) error {
	changed := sql.P(func(b *sql.Builder) {
		b.WriteString("(licenses.name, licenses.text_hash, licenses.version, licenses.official_url) IS DISTINCT FROM " +
			"(excluded.name, excluded.text_hash, excluded.version, excluded.official_url)")
	})

	err := r.newLicense(data).
		OnConflict(
			sql.ConflictColumns(entlicense.FieldCanonicalID),
			sql.ConflictWhere(sql.P(func(b *sql.Builder) { b.WriteString("source_type = 'CANONICAL' AND is_draft = false") })),
			sql.UpdateWhere(changed),
		).
		Update(func(u *ent.LicenseUpsert) {
			u.UpdateName().UpdateText().UpdateTextHash().UpdateVersion().UpdateOfficialURL().UpdateUpdatedAt()
		}).
		Exec(ctx)
	if errors.Is(err, stdsql.ErrNoRows) {
		return nil // the row is there and has nothing to change, so the statement returned no row
	}

	return err
}

func (r *repository) countDrafts(ctx context.Context, ownerID string) (int, error) {
	return r.client.License.Query().Where(entlicense.OwnerID(ownerID), entlicense.IsDraft(true)).Count(ctx)
}

func (r *repository) insertDraft(ctx context.Context, ownerID string, base DraftSave, version string) (*ent.License, error) {
	return r.client.License.Create().
		SetVersion(version).
		SetName(base.Name).
		SetText(base.Text).
		SetSourceType(base.SourceType).
		SetNillableCanonicalID(base.CanonicalID).
		SetOwnerID(ownerID).
		SetIsDraft(true).
		Save(ctx)
}

// draft finds a draft of the owner; an empty ownerID finds the draft of anybody.
func (r *repository) draft(ctx context.Context, id uuid.UUID, ownerID string) (*ent.License, error) {
	query := r.client.License.Query().Where(entlicense.ID(id), entlicense.IsDraft(true))
	if ownerID != "" {
		query = query.Where(entlicense.OwnerID(ownerID))
	}

	return query.Only(ctx)
}

// updateDraft names the owner and the draft flag, so a draft finalized a moment ago cannot be changed by a late save. It returns how many
// rows changed.
func (r *repository) updateDraft(ctx context.Context, ownerID string, save DraftSave) (int, error) {
	update := r.client.License.Update().
		Where(entlicense.ID(save.ID), entlicense.OwnerID(ownerID), entlicense.IsDraft(true)).
		SetName(save.Name).
		SetText(save.Text).
		SetSourceType(save.SourceType)
	if save.CanonicalID == nil {
		update.ClearCanonicalID()
	} else {
		update.SetCanonicalID(*save.CanonicalID)
	}

	return update.Save(ctx)
}

func (r *repository) deleteDraft(ctx context.Context, ownerID string, id uuid.UUID) (int, error) {
	return r.client.License.Delete().Where(entlicense.ID(id), entlicense.OwnerID(ownerID), entlicense.IsDraft(true)).Exec(ctx)
}

// promote turns a draft of the owner into the finished license data. It returns how many rows changed.
func (r *repository) promote(ctx context.Context, ownerID string, id uuid.UUID, data stored) (int, error) {
	update := r.client.License.Update().
		Where(entlicense.ID(id), entlicense.OwnerID(ownerID), entlicense.IsDraft(true)).
		SetName(data.Name).
		SetText(data.Text).
		SetTextHash(data.TextHash).
		SetOwnerID(data.OwnerID).
		SetSourceType(data.SourceType).
		SetNillableCanonicalID(data.CanonicalID).
		SetIsDraft(false)
	if m := data.Metadata; m != nil {
		update.SetVersion(m.Version).SetOfficialURL(m.OfficialURL)
	}

	return update.Save(ctx)
}

// lockDefault serializes the switches of the default license: the database cannot hold a partial unique index on is_default, and ent
// cannot express a transaction-level advisory lock, so this is raw SQL.
func (r *repository) lockDefault(ctx context.Context) error {
	_, err := r.client.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext('licenses.is_default'))`)

	return err
}

func (r *repository) makeDefault(ctx context.Context, id uuid.UUID) error {
	if err := r.client.License.Update().Where(entlicense.IsDefault(true), entlicense.IDNEQ(id)).SetIsDefault(false).Exec(ctx); err != nil {
		return err
	}

	return r.client.License.UpdateOneID(id).SetIsDefault(true).Exec(ctx)
}
