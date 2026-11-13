package novel

import (
	"context"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/chaptercontent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
	entnovel "github.com/Ponos-OS/smart-novel/apps/backend/ent/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
)

// repository is the only place of this package, with the list queries of filter.go and page.go, that builds database queries. It decides
// nothing: no authorization, no business rule, and the errors it returns are the database's own. Inside a transaction it is made from
// the transaction's client: newRepository(tx.Client()).
type repository struct {
	client *ent.Client
}

func newRepository(client *ent.Client) *repository {
	return &repository{client: client}
}

func (r *repository) novel(ctx context.Context, id uuid.UUID) (*ent.Novel, error) {
	return r.client.Novel.Get(ctx, id)
}

// novelWithWriter loads a novel with its writer, and takes the row lock chapters share when lock is set.
func (r *repository) novelWithWriter(ctx context.Context, id uuid.UUID, lock bool) (*ent.Novel, error) {
	query := r.client.Novel.Query().Where(entnovel.ID(id)).WithWriter()
	if lock {
		query = query.ForUpdate()
	}

	return query.Only(ctx)
}

func (r *repository) writerID(ctx context.Context, userID string) (uuid.UUID, error) {
	return r.client.Writer.Query().Where(writer.UserID(userID)).OnlyID(ctx)
}

func (r *repository) defaultLicenseID(ctx context.Context) (uuid.UUID, error) {
	return r.client.License.Query().Where(license.IsDefault(true)).OnlyID(ctx)
}

func (r *repository) approvedTags(ctx context.Context, names []string) ([]*ent.Tag, error) {
	return r.client.Tag.Query().Where(tag.NameIn(names...), tag.StatusEQ(tag.StatusAPPROVED)).All(ctx)
}

func (r *repository) createNovel(ctx context.Context, input CreateInput, writerID, licenseID uuid.UUID, tagIDs []uuid.UUID) (*ent.Novel, error) {
	create := r.client.Novel.Create().
		SetName(input.Name).
		SetDescription(input.Description).
		SetWriterID(writerID).
		SetLicenseID(licenseID).
		AddTagIDs(tagIDs...)
	if input.State != nil {
		create.SetState(*input.State)
	}

	return create.Save(ctx)
}

// updateNovel changes the given fields. When replaceTags is set the tags become exactly tagIDs.
func (r *repository) updateNovel(ctx context.Context, id uuid.UUID, input UpdateInput, replaceTags bool, tagIDs []uuid.UUID) error {
	update := r.client.Novel.UpdateOneID(id).
		SetNillableName(input.Name).
		SetNillableDescription(input.Description).
		SetNillableState(input.State)
	if replaceTags {
		update.ClearTags().AddTagIDs(tagIDs...)
	}

	return update.Exec(ctx)
}

func (r *repository) chaptersOf(ctx context.Context, novelID uuid.UUID) ([]*ent.Chapter, error) {
	return r.client.Chapter.Query().Where(chapter.NovelID(novelID)).All(ctx)
}

// deleteNovel removes the novel and, since a chapter and its content cascade the other way round, the contents of its chapters.
func (r *repository) deleteNovel(ctx context.Context, id uuid.UUID, contentIDs []uuid.UUID) error {
	if err := r.client.Novel.DeleteOneID(id).Exec(ctx); err != nil {
		return err
	}
	_, err := r.client.ChapterContent.Delete().Where(chaptercontent.IDIn(contentIDs...)).Exec(ctx)

	return err
}
