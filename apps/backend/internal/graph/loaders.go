package graph

import (
	"context"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"
	"github.com/vikstrous/dataloadgen"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/chaptercontent"
	entlicense "github.com/Ponos-OS/smart-novel/apps/backend/ent/license"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/chapter"
)

const loadWait = time.Millisecond

type loadersKey struct{}

// readKey is a chapter and the user whose read state is asked for.
type readKey struct {
	User    string
	Chapter uuid.UUID
}

// loaders batch the lookups a list of items would each repeat, for the length of one operation.
type loaders struct {
	writers  *dataloadgen.Loader[uuid.UUID, *ent.Writer]
	contents *dataloadgen.Loader[uuid.UUID, *ent.ChapterContent]
	licenses *dataloadgen.Loader[uuid.UUID, *ent.License]
	readAt   *dataloadgen.Loader[readKey, *time.Time]
}

func newLoaders(client *ent.Client, chapters *chapter.Service) *loaders {
	return &loaders{
		writers: dataloadgen.NewLoader(
			func(ctx context.Context, ids []uuid.UUID) ([]*ent.Writer, []error) {
				found, err := client.Writer.Query().
					Where(writer.IDIn(ids...)).
					All(ctx)

				return arrange(
					ids,
					found,
					err,
					func(w *ent.Writer) uuid.UUID { return w.ID },
				)
			},
			dataloadgen.WithWait(loadWait),
		),
		contents: dataloadgen.NewLoader(
			func(ctx context.Context, ids []uuid.UUID) ([]*ent.ChapterContent, []error) {
				found, err := client.ChapterContent.Query().
					Where(chaptercontent.IDIn(ids...)).
					All(ctx)

				return arrange(
					ids,
					found,
					err,
					func(c *ent.ChapterContent) uuid.UUID { return c.ID },
				)
			},
			dataloadgen.WithWait(loadWait),
		),
		licenses: dataloadgen.NewLoader(
			func(ctx context.Context, ids []uuid.UUID) ([]*ent.License, []error) {
				found, err := client.License.Query().
					Where(entlicense.IDIn(ids...), entlicense.IsDraft(false)).
					All(ctx)

				return arrange(
					ids,
					found,
					err,
					func(l *ent.License) uuid.UUID { return l.ID },
				)
			},
			dataloadgen.WithWait(loadWait),
		),
		readAt: dataloadgen.NewLoader(
			func(ctx context.Context, keys []readKey) ([]*time.Time, []error) {
				return readTimes(ctx, chapters, keys)
			},
			dataloadgen.WithWait(loadWait),
		),
	}
}

// arrange puts the rows in the order of the keys the loader asked for, as it requires; a key without a row gets a not found error.
func arrange[T any](
	ids []uuid.UUID,
	rows []T,
	err error,
	idOf func(T) uuid.UUID,
) ([]T, []error) {
	values := make([]T, len(ids))
	errs := make([]error, len(ids))
	if err != nil {
		for index := range errs {
			errs[index] = err
		}

		return values, errs
	}
	byID := make(map[uuid.UUID]T, len(rows))
	for _, row := range rows {
		byID[idOf(row)] = row
	}
	for index, id := range ids {
		row, ok := byID[id]
		if !ok {
			errs[index] = &ent.NotFoundError{}

			continue
		}
		values[index] = row
	}

	return values, errs
}

// readTimes finds when each user first read each chapter; a chapter they did not read has a nil time.
func readTimes(
	ctx context.Context,
	chapters *chapter.Service,
	keys []readKey,
) ([]*time.Time, []error) {
	chaptersByUser := make(map[string][]uuid.UUID)
	for _, key := range keys {
		chaptersByUser[key.User] = append(chaptersByUser[key.User], key.Chapter)
	}
	found := make(map[readKey]time.Time, len(keys))
	failed := make(map[string]error)
	for user, ids := range chaptersByUser {
		read, err := chapters.ReadAt(ctx, user, ids)
		if err != nil {
			failed[user] = err

			continue
		}
		for id, at := range read {
			found[readKey{User: user, Chapter: id}] = at
		}
	}
	values := make([]*time.Time, len(keys))
	errs := make([]error, len(keys))
	for index, key := range keys {
		errs[index] = failed[key.User]
		if at, ok := found[key]; ok {
			values[index] = &at
		}
	}

	return values, errs
}

func loadersFrom(ctx context.Context) *loaders {
	found, ok := ctx.Value(loadersKey{}).(*loaders)
	if !ok {
		panic("the loaders are missing: LoaderExtension is not installed")
	}

	return found
}

// LoaderExtension gives every operation its own loaders, so a batch never mixes the requests of two callers.
type LoaderExtension struct {
	client   *ent.Client
	chapters *chapter.Service
}

func NewLoaderExtension(
	client *ent.Client,
	chapters *chapter.Service,
) LoaderExtension {
	return LoaderExtension{client: client, chapters: chapters}
}

func (LoaderExtension) ExtensionName() string { return "Loaders" }

func (LoaderExtension) Validate(graphql.ExecutableSchema) error { return nil }

func (e LoaderExtension) InterceptOperation(
	ctx context.Context,
	next graphql.OperationHandler,
) graphql.ResponseHandler {
	return next(
		context.WithValue(ctx, loadersKey{}, newLoaders(e.client, e.chapters)),
	)
}
