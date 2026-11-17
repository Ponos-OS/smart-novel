package writer

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/schema"
	entwriter "github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
)

// repository is the only place of this package that builds database queries. It decides nothing, and the errors it returns are the
// database's own. Inside a transaction it is made from the transaction's client: newRepository(tx.Client()).
type repository struct {
	client *ent.Client
}

func newRepository(client *ent.Client) *repository {
	return &repository{client: client}
}

func (r *repository) byUserID(
	ctx context.Context,
	userID string,
) (*ent.Writer, error) {
	return r.client.Writer.Query().Where(entwriter.UserID(userID)).Only(ctx)
}

// lockedByUserID takes the row lock, so two requests of one user are handled one after the other.
func (r *repository) lockedByUserID(
	ctx context.Context,
	userID string,
) (*ent.Writer, error) {
	return r.client.Writer.Query().
		Where(entwriter.UserID(userID)).
		ForUpdate().
		Only(ctx)
}

func (r *repository) lockedByID(
	ctx context.Context,
	id uuid.UUID,
) (*ent.Writer, error) {
	return r.client.Writer.Query().Where(entwriter.ID(id)).ForUpdate().Only(ctx)
}

func (r *repository) byID(
	ctx context.Context,
	id uuid.UUID,
) (*ent.Writer, error) {
	return r.client.Writer.Get(ctx, id)
}

// ownerOfPenName is the user ID of the writer who has the pen name, which is compared without regard to case; empty when nobody has it.
func (r *repository) ownerOfPenName(
	ctx context.Context,
	penName string,
) (string, error) {
	found, err := r.client.Writer.Query().
		Where(entwriter.PenName(penName)).
		Only(ctx)
	if ent.IsNotFound(err) {
		return "", nil
	}
	if err != nil {
		return "", err
	}

	return found.UserID, nil
}

func (r *repository) create(
	ctx context.Context,
	identity Identity,
	penName string,
	applications []schema.WriterApplication,
) (*ent.Writer, error) {
	return r.client.Writer.Create().
		SetUserID(identity.UserID).
		SetName(identity.Name).
		SetEmail(identity.Email).
		SetPenName(penName).
		SetApplications(applications).
		Save(ctx)
}

// reapply starts the next application of a rejected user: the identity and the pen name are the new ones, the status is PENDING again and
// the request is back at the end of the queue.
func (r *repository) reapply(
	ctx context.Context,
	id uuid.UUID,
	identity Identity,
	penName string,
	applications []schema.WriterApplication,
) (*ent.Writer, error) {
	return r.client.Writer.UpdateOneID(id).
		SetName(identity.Name).
		SetEmail(identity.Email).
		SetPenName(penName).
		SetStatus(entwriter.StatusPENDING).
		SetCreatedAt(time.Now()).
		SetApplications(applications).
		Save(ctx)
}

func (r *repository) review(
	ctx context.Context,
	id uuid.UUID,
	status entwriter.Status,
	applications []schema.WriterApplication,
) (*ent.Writer, error) {
	return r.client.Writer.UpdateOneID(id).
		SetStatus(status).
		SetApplications(applications).
		Save(ctx)
}
