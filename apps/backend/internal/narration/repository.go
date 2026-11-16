package narration

import (
	"context"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/chapter"
)

// repository is the only place of this package that builds ent queries. It decides nothing and returns the database's own errors.
type repository struct {
	client *ent.Client
}

func newRepository(client *ent.Client) *repository {
	return &repository{client: client}
}

// chapterWithOwner loads a chapter with its novel and the writer of the novel.
func (r *repository) chapterWithOwner(ctx context.Context, id uuid.UUID) (*ent.Chapter, error) {
	return r.client.Chapter.Query().Where(chapter.ID(id)).WithNovel(func(q *ent.NovelQuery) { q.WithWriter() }).Only(ctx)
}

func (r *repository) text(ctx context.Context, contentID uuid.UUID) (string, error) {
	content, err := r.client.ChapterContent.Get(ctx, contentID)
	if err != nil {
		return "", err
	}

	return content.Content, nil
}

// setNarrationURL does not mind a chapter that was deleted while its audio was made: there is nothing to update then, which is not an error.
func (r *repository) setNarrationURL(ctx context.Context, id uuid.UUID, url string) error {
	return r.client.Chapter.Update().Where(chapter.ID(id)).SetNarrationURL(url).Exec(ctx)
}
