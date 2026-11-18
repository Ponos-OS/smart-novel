package devdata

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/novel"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/tag"
	"github.com/Ponos-OS/smart-novel/apps/backend/ent/writer"
	license "github.com/Ponos-OS/smart-novel/apps/backend/internal/license"
)

const (
	logKeyNovel    = "novel"
	logKeyChapters = "chapters"
)

// Options say which novels to seed and who the seeded accounts are.
type Options struct {
	Tags    []string
	Novels  []Novel
	Writers []Writer
	Logger  *slog.Logger
}

// Run adds the demo data; running it again changes nothing.
func Run(ctx context.Context, client *ent.Client, options Options) error {
	err := addTags(ctx, client, allTags(options))
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
	for index, seed := range options.Novels {
		ownerPosition := index % len(options.Writers)
		owner := writerIDs[options.Writers[ownerPosition].UserID]
		if err := addNovel(
			ctx,
			client,
			options.Logger,
			seed,
			owner,
			licenseID,
		); err != nil {
			return fmt.Errorf("adding the novel %q: %w", seed.Name, err)
		}
	}

	return nil
}

func allTags(options Options) []string {
	tags := slices.Clone(options.Tags)
	for index, name := range tags {
		tags[index] = strings.ToLower(name)
	}
	tags = append(tags, UniqueTags(options.Novels)...)
	slices.Sort(tags)

	return slices.Compact(tags)
}

func addTags(
	ctx context.Context,
	client *ent.Client,
	names []string,
) error {
	if len(names) == 0 {
		return nil
	}
	creates := make([]*ent.TagCreate, len(names))
	for index, name := range names {
		creates[index] = client.Tag.Create().SetName(name)
	}
	err := client.Tag.CreateBulk(creates...).
		OnConflictColumns(tag.FieldName).
		DoNothing().
		Exec(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}

	return err
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
	seed Novel,
	ownerID, defaultLicenseID uuid.UUID,
) error {
	details := seed.NovelDetails
	exists, err := client.Novel.Query().Where(novel.ID(details.ID)).Exist(ctx)
	if err != nil || exists {
		return err
	}
	tx, err := client.Tx(ctx)
	if err != nil {
		return err
	}
	if err := insertNovel(
		ctx,
		tx,
		details,
		seed.Chapters,
		ownerID,
		defaultLicenseID,
	); err != nil {
		return errors.Join(err, tx.Rollback())
	}
	logger.InfoContext(
		ctx,
		"added a novel",
		slog.String(logKeyNovel, details.Name),
		slog.Int(logKeyChapters, len(seed.Chapters)),
	)

	return tx.Commit()
}

func insertNovel(
	ctx context.Context,
	tx *ent.Tx,
	details NovelDetails,
	chapters []Chapter,
	ownerID, licenseID uuid.UUID,
) error {
	tagIDs, err := tx.Tag.Query().Where(tag.NameIn(details.Tags...)).IDs(ctx)
	if err != nil {
		return err
	}
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
