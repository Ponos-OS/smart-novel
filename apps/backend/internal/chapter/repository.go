package chapter

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/chapter"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/chapteruserstate"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/novel"
)

// repository is the only place of this package that builds database queries. It decides nothing: no authorization, no business rule,
// and the errors it returns are the database's own. Inside a transaction it is made from the transaction's client: newRepository(tx.Client()).
type repository struct {
	client *ent.Client
}

func newRepository(client *ent.Client) *repository {
	return &repository{client: client}
}

func (r *repository) chapter(
	ctx context.Context,
	id uuid.UUID,
) (*ent.Chapter, error) {
	return r.client.Chapter.Get(ctx, id)
}

// chapterWithOwner loads a chapter with its novel and the writer of the novel.
func (r *repository) chapterWithOwner(
	ctx context.Context,
	id uuid.UUID,
) (*ent.Chapter, error) {
	return r.client.Chapter.Query().
		Where(chapter.ID(id)).
		WithNovel(func(q *ent.NovelQuery) { q.WithWriter() }).
		Only(ctx)
}

// chapterOfNovel is nil when the novel has no chapter with this ID.
func (r *repository) chapterOfNovel(
	ctx context.Context,
	novelID, id uuid.UUID,
) (*ent.Chapter, error) {
	return orNil(
		r.client.Chapter.Query().
			Where(chapter.ID(id), chapter.NovelID(novelID)).
			Only(ctx),
	)
}

// chapterAt is nil when the novel has no chapter with this number.
func (r *repository) chapterAt(
	ctx context.Context,
	novelID uuid.UUID,
	number int,
) (*ent.Chapter, error) {
	return orNil(
		r.client.Chapter.Query().
			Where(chapter.NovelID(novelID), chapter.ChapterNumber(number)).
			Only(ctx),
	)
}

// firstChapter is nil when the novel has no chapter.
func (r *repository) firstChapter(
	ctx context.Context,
	novelID uuid.UUID,
) (*ent.Chapter, error) {
	return orNil(
		r.client.Chapter.Query().
			Where(chapter.NovelID(novelID)).
			Order(ent.Asc(chapter.FieldChapterNumber)).
			First(ctx),
	)
}

// lastChapter is nil when the novel has no chapter.
func (r *repository) lastChapter(
	ctx context.Context,
	novelID uuid.UUID,
) (*ent.Chapter, error) {
	return orNil(
		r.client.Chapter.Query().
			Where(chapter.NovelID(novelID)).
			Order(ent.Desc(chapter.FieldChapterNumber)).
			First(ctx),
	)
}

// lockNovel takes the row lock every change of a novel's chapters shares, and returns the novel with its writer.
func (r *repository) lockNovel(
	ctx context.Context,
	id uuid.UUID,
) (*ent.Novel, error) {
	return r.client.Novel.Query().
		Where(novel.ID(id)).
		WithWriter().
		ForUpdate().
		Only(ctx)
}

func (r *repository) nextNumber(
	ctx context.Context,
	novelID uuid.UUID,
) (int, error) {
	last, err := r.client.Chapter.Query().
		Where(chapter.NovelID(novelID)).
		Order(ent.Desc(chapter.FieldChapterNumber)).
		First(ctx)
	if ent.IsNotFound(err) {
		return 1, nil
	}
	if err != nil {
		return 0, err
	}

	return last.ChapterNumber + 1, nil
}

func (r *repository) content(
	ctx context.Context,
	contentID uuid.UUID,
) (*ent.ChapterContent, error) {
	return r.client.ChapterContent.Get(ctx, contentID)
}

func (r *repository) createChapter(
	ctx context.Context,
	novelID uuid.UUID,
	title, content, contentHash string,
	number int,
) (*ent.Chapter, error) {
	stored, err := r.client.ChapterContent.Create().
		SetContent(content).
		SetContentHash(contentHash).
		Save(ctx)
	if err != nil {
		return nil, err
	}

	return r.client.Chapter.Create().
		SetNovelID(novelID).
		SetContentID(stored.ID).
		SetTitle(title).
		SetChapterNumber(number).
		Save(ctx)
}

func (r *repository) setFirstChapterDate(
	ctx context.Context,
	novelID uuid.UUID,
	at time.Time,
) error {
	return r.client.Novel.UpdateOneID(novelID).
		SetFirstChapterCreatedAt(at).
		Exec(ctx)
}

// updateContent writes the text on its own so the chapter's updated_at, the version token of its metadata, stays put.
func (r *repository) updateContent(
	ctx context.Context,
	contentID uuid.UUID,
	content, contentHash string,
) error {
	return r.client.ChapterContent.UpdateOneID(contentID).
		SetContent(content).
		SetContentHash(contentHash).
		Exec(ctx)
}

func (r *repository) updateTitle(
	ctx context.Context,
	id uuid.UUID,
	title *string,
) (*ent.Chapter, error) {
	return r.client.Chapter.UpdateOneID(id).SetNillableTitle(title).Save(ctx)
}

// deleteChapter removes the chapter and its content, renumbers the later chapters of the novel down by one, and moves the first chapter
// date of the novel to the earliest chapter that is left, or clears it.
func (r *repository) deleteChapter(
	ctx context.Context,
	doomed *ent.Chapter,
) error {
	// A chapter and its content cascade from the content, so the content row goes explicitly.
	if err := r.client.Chapter.DeleteOneID(doomed.ID).Exec(ctx); err != nil {
		return err
	}
	if err := r.client.ChapterContent.DeleteOneID(doomed.ContentID).
		Exec(ctx); err != nil {
		return err
	}
	if _, err := r.client.Chapter.Update().
		Where(chapter.NovelID(doomed.NovelID), chapter.ChapterNumberGT(doomed.ChapterNumber)).
		AddChapterNumber(-1).
		Save(ctx); err != nil {
		return err
	}

	return r.refreshFirstChapterDate(ctx, doomed.NovelID)
}

func (r *repository) refreshFirstChapterDate(
	ctx context.Context,
	novelID uuid.UUID,
) error {
	earliest, err := r.client.Chapter.Query().
		Where(chapter.NovelID(novelID)).
		Order(ent.Asc(chapter.FieldCreatedAt)).
		First(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return err
	}
	update := r.client.Novel.UpdateOneID(novelID)
	if earliest == nil {
		update.ClearFirstChapterCreatedAt()
	} else {
		update.SetFirstChapterCreatedAt(earliest.CreatedAt)
	}

	return update.Exec(ctx)
}

// markRead is raw SQL on purpose: ent's builders cannot insert from a select, and the two-step version (read the chapters, then insert) is
// longer, can race with a chapter being deleted and cannot report how many rows were new. The novel of each chapter is read from the chapter
// itself, so a caller cannot pair a chapter with another novel. It returns how many records are new.
func (r *repository) markRead(
	ctx context.Context,
	userID string,
	chapterIDs []uuid.UUID,
) (int, error) {
	ids := make([]string, len(chapterIDs))
	for index, id := range chapterIDs {
		ids[index] = id.String()
	}
	result, err := r.client.ExecContext(ctx, `
		INSERT INTO `+chapteruserstate.Table+` (id, user_id, novel_id, chapter_id)
		SELECT gen_random_uuid(), $1, chapters.novel_id, chapters.id FROM chapters WHERE chapters.id = ANY($2::uuid[])
		ON CONFLICT (user_id, chapter_id) DO NOTHING`, userID, ids)
	if err != nil {
		return 0, err
	}
	marked, err := result.RowsAffected()

	return int(marked), err
}

func (r *repository) deleteReadHistory(
	ctx context.Context,
	userID string,
) (int, error) {
	return r.client.ChapterUserState.Delete().
		Where(chapteruserstate.UserID(userID)).
		Exec(ctx)
}

func (r *repository) readStates(
	ctx context.Context,
	userID string,
	chapterIDs []uuid.UUID,
) ([]*ent.ChapterUserState, error) {
	return r.client.ChapterUserState.Query().
		Where(chapteruserstate.UserID(userID), chapteruserstate.ChapterIDIn(chapterIDs...)).
		All(ctx)
}

func orNil(found *ent.Chapter, err error) (*ent.Chapter, error) {
	if ent.IsNotFound(err) {
		return nil, nil
	}

	return found, err
}
