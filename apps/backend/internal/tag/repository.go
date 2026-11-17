package tag

import (
	"context"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	enttag "github.com/Ponos-OS/smart-novel/apps/backend/ent/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/graph/model"
)

// repository is the only place of this package that builds database queries. It decides nothing, and the errors it returns are the
// database's own.
type repository struct {
	client *ent.Client
}

func newRepository(client *ent.Client) *repository {
	return &repository{client: client}
}

func (r *repository) createPending(
	ctx context.Context,
	input model.RequestTagInput,
	requesterUserID string,
) (*ent.Tag, error) {
	return r.client.Tag.Create().
		SetName(input.Name).
		SetDescription(input.Description).
		SetStatus(enttag.StatusPENDING).
		SetRequesterUserID(requesterUserID).
		Save(ctx)
}

// createApproved stores a tag with the default status, which is approved.
func (r *repository) createApproved(
	ctx context.Context,
	input model.CreateTagInput,
) (*ent.Tag, error) {
	return r.client.Tag.Create().
		SetName(input.Name).
		SetDescription(input.Description).
		Save(ctx)
}

// approve changes a pending tag to approved; an approved or missing one is left as it is.
func (r *repository) approve(ctx context.Context, id uuid.UUID) error {
	return r.client.Tag.Update().
		Where(enttag.ID(id), enttag.StatusEQ(enttag.StatusPENDING)).
		SetStatus(enttag.StatusAPPROVED).
		Exec(ctx)
}

func (r *repository) tag(ctx context.Context, id uuid.UUID) (*ent.Tag, error) {
	return r.client.Tag.Get(ctx, id)
}

func (r *repository) update(
	ctx context.Context,
	id uuid.UUID,
	changes model.UpdateTagInput,
) (*ent.Tag, error) {
	return r.client.Tag.UpdateOneID(id).
		SetNillableName(changes.Name).
		SetNillableDescription(changes.Description).
		Save(ctx)
}

func (r *repository) delete(ctx context.Context, id uuid.UUID) error {
	return r.client.Tag.DeleteOneID(id).Exec(ctx)
}
