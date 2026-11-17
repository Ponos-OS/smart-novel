package devdata

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
	license "github.com/Ponos-OS/smart-novel/apps/backend/internal/license"
)

var (
	ErrNovelWriterMissing = errors.New(
		"the writer of the example novels is not among SEEDED_WRITERS",
	)
	ErrTagMissing = errors.New("the tag was not added")
)

const (
	logKeyNovel    = "novel"
	logKeyChapters = "chapters"
)

// Options say where the example data is and who the seeded accounts are.
type Options struct {
	DataPath string
	Writers  []Writer
	// NovelWriterUserID is the account the example novels belong to; it must be one of Writers.
	NovelWriterUserID string
	Logger            *slog.Logger
}

// Run adds the demo data; running it again changes nothing.
func Run(ctx context.Context, client *ent.Client, options Options) error {
	directories, err := novelDirectories(options.DataPath)
	if err != nil {
		return err
	}
	novels := make([]NovelDetails, len(directories))
	for index, directory := range directories {
		novels[index] = directory.NovelDetails
	}
	tagIDs, err := addTags(ctx, client, UniqueTags(novels))
	if err != nil {
		return fmt.Errorf("adding tags: %w", err)
	}
	defaultLicense, err := license.NewService(client, nil, slog.Default()).
		EnsureDefault(ctx)
	if err != nil {
		return fmt.Errorf("adding the default license: %w", err)
	}
	licenseID := defaultLicense.ID
	writerIDs, err := addWriters(ctx, client, options.Writers)
	if err != nil {
		return fmt.Errorf("adding writers: %w", err)
	}
	owner, ok := writerIDs[options.NovelWriterUserID]
	if !ok {
		return fmt.Errorf(
			"%w: %s",
			ErrNovelWriterMissing,
			options.NovelWriterUserID,
		)
	}
	for _, directory := range directories {
		if err := addNovel(
			ctx,
			client,
			options.Logger,
			directory,
			owner,
			licenseID,
			tagIDs,
		); err != nil {
			return fmt.Errorf("adding the novel %q: %w", directory.Name, err)
		}
	}

	return nil
}

type novelDirectory struct {
	NovelDetails
	dir string
}

func novelDirectories(dataPath string) ([]novelDirectory, error) {
	entries, err := os.ReadDir(dataPath)
	if err != nil {
		return nil, err
	}
	var directories []novelDirectory
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		dir := filepath.Join(dataPath, entry.Name())
		raw, err := os.ReadFile( //nolint:gosec // devdata reads the data directory its operator mounted
			filepath.Join(dir, "details.json"),
		)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return nil, err
		}
		var details NovelDetails
		if err := json.Unmarshal(raw, &details); err != nil {
			return nil, fmt.Errorf("%s/details.json: %w", entry.Name(), err)
		}
		directories = append(
			directories,
			novelDirectory{NovelDetails: details, dir: dir},
		)
	}

	return directories, nil
}

func addTags(
	ctx context.Context,
	client *ent.Client,
	names []string,
) (map[string]uuid.UUID, error) {
	if len(names) > 0 {
		creates := make([]*ent.TagCreate, len(names))
		for index, name := range names {
			creates[index] = client.Tag.Create().SetName(name)
		}
		if err := client.Tag.CreateBulk(creates...).
			OnConflictColumns(tag.FieldName).
			DoNothing().
			Exec(ctx); err != nil &&
			!errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
	}
	tags, err := client.Tag.Query().Where(tag.NameIn(names...)).All(ctx)
	if err != nil {
		return nil, err
	}
	ids := make(map[string]uuid.UUID, len(tags))
	for _, found := range tags {
		ids[found.Name] = found.ID
	}

	return ids, nil
}

func addWriters(
	ctx context.Context,
	client *ent.Client,
	writers []Writer,
) (map[string]uuid.UUID, error) {
	ids := make(map[string]uuid.UUID, len(writers))
	for _, account := range writers {
		existing, err := client.Writer.Query().
			Where(writer.UserID(account.UserID)).
			Only(ctx)
		if err == nil {
			ids[account.UserID] = existing.ID

			continue
		}
		if !ent.IsNotFound(err) {
			return nil, err
		}
		created, err := client.Writer.Create().
			SetUserID(account.UserID).
			SetName(account.Name).
			SetEmail(account.Email).
			SetPenName(account.PenName).
			SetStatus(writer.StatusAPPROVED).
			Save(ctx)
		if err != nil {
			return nil, err
		}
		ids[account.UserID] = created.ID
	}

	return ids, nil
}

func addNovel(
	ctx context.Context,
	client *ent.Client,
	logger *slog.Logger,
	directory novelDirectory,
	ownerID, defaultLicenseID uuid.UUID,
	tagIDs map[string]uuid.UUID,
) error {
	details := directory.NovelDetails
	exists, err := client.Novel.Query().Where(novel.ID(details.ID)).Exist(ctx)
	if err != nil || exists {
		return err
	}
	chapters, err := LoadChapters(directory.dir)
	if err != nil {
		return err
	}
	var novelTags []uuid.UUID
	for _, name := range details.Tags {
		id, ok := tagIDs[strings.ToLower(name)]
		if !ok {
			return fmt.Errorf("%w: %q", ErrTagMissing, name)
		}
		novelTags = append(novelTags, id)
	}
	tx, err := client.Tx(ctx)
	if err != nil {
		return err
	}
	if err := insertNovel(
		ctx,
		tx,
		details,
		chapters,
		ownerID,
		defaultLicenseID,
		novelTags,
	); err != nil {
		return errors.Join(err, tx.Rollback())
	}
	logger.InfoContext(
		ctx,
		"added a novel",
		slog.String(logKeyNovel, details.Name),
		slog.Int(logKeyChapters, len(chapters)),
	)

	return tx.Commit()
}

func insertNovel(
	ctx context.Context,
	tx *ent.Tx,
	details NovelDetails,
	chapters []Chapter,
	ownerID, licenseID uuid.UUID,
	tagIDs []uuid.UUID,
) error {
	create := tx.Novel.Create().
		SetID(details.ID).
		SetName(details.Name).
		SetDescription(details.Description).
		SetWriterID(ownerID).
		SetLicenseID(licenseID).
		AddTagIDs(tagIDs...)
	if details.State != "" {
		create.SetState(novel.State(details.State))
	}
	if details.CoverURL != "" {
		create.SetCoverURL(details.CoverURL)
	}
	if _, err := create.Save(ctx); err != nil {
		return err
	}
	var first *ent.Chapter
	for _, chapter := range chapters {
		content, err := tx.ChapterContent.Create().
			SetContent(chapter.Content).
			SetContentHash(contentHash(chapter.Content)).
			Save(ctx)
		if err != nil {
			return err
		}
		created, err := tx.Chapter.Create().
			SetID(chapter.ID).
			SetNovelID(details.ID).
			SetContentID(content.ID).
			SetTitle(chapter.Title).
			SetChapterNumber(chapter.Number).
			Save(ctx)
		if err != nil {
			return err
		}
		if first == nil {
			first = created
		}
	}
	if first == nil {
		return nil
	}

	return tx.Novel.UpdateOneID(details.ID).
		SetFirstChapterCreatedAt(first.CreatedAt).
		Exec(ctx)
}

func contentHash(content string) string {
	sum := sha256.Sum256([]byte(content))

	return hex.EncodeToString(sum[:])
}
