// Package chapter holds the rules for chapters: numbering, editing with a version check, navigation and read state.
package chapter

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/background"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/entx"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/narration"
)

const (
	notFoundMessage = "Chapter not found"
	staleMessage    = "This chapter was updated by someone else. Reload to get the latest version before saving."

	// timestamptz keeps microseconds; a client may round trip the time through a shorter format.
	storedPrecision = time.Microsecond
)

// Service decides who may change what and in which order; the queries are in the repository.
type Service struct {
	client    *ent.Client
	repo      *repository
	narration *narration.Service
	logger    *slog.Logger
}

func NewService(client *ent.Client, narrationService *narration.Service, logger *slog.Logger) *Service {
	return &Service{client: client, repo: newRepository(client), narration: narrationService, logger: logger}
}

// Create adds a chapter at the end of a novel its owner or an admin owns. The input is already normalized.
func (s *Service) Create(ctx context.Context, viewer auth.Viewer, novelID uuid.UUID, input CreateInput) (*ent.Chapter, error) {
	var createdID uuid.UUID
	err := entx.WithTx(ctx, s.client, func(tx *ent.Tx) error {
		repo := newRepository(tx.Client())
		target, err := lockedNovel(ctx, repo, novelID)
		if err != nil {
			return err
		}
		if err = authorize(viewer, auth.Create, target); err != nil {
			return err
		}
		number, err := repo.nextNumber(ctx, novelID)
		if err != nil {
			return err
		}
		created, err := repo.createChapter(ctx, novelID, input.Title, input.Content, hash(input.Content), number)
		if err != nil {
			return err
		}
		createdID = created.ID
		if target.FirstChapterCreatedAt != nil {
			return nil
		}

		return repo.setFirstChapterDate(ctx, novelID, created.CreatedAt)
	})
	if err != nil {
		return nil, err
	}

	s.narrate(ctx, createdID, input.Content)

	// Read again outside the transaction: an entity from it cannot load its edges once it is committed.
	return s.repo.chapter(ctx, createdID)
}

// narrate starts the audio of a chapter whose text was just saved, in the background: the save is committed and the writer should not wait for Beatrice, nor lose the save when it fails.
func (s *Service) narrate(ctx context.Context, id uuid.UUID, text string) {
	background.Go(ctx, s.logger, "narrating a chapter", func(ctx context.Context) {
		s.narration.Regenerate(ctx, id, text)
	})
}

// UpdateContent replaces the text of a chapter if nobody else changed it since the client read it at expected.
// The returned bool is false when the text was byte-identical to what is stored, in which case nothing is written.
func (s *Service) UpdateContent(ctx context.Context, viewer auth.Viewer, id uuid.UUID, content string, expected time.Time) (*ent.Chapter, bool, error) {
	target, err := s.authorizedChapter(ctx, viewer, auth.Update, id)
	if err != nil {
		return nil, false, err
	}
	current, err := s.repo.content(ctx, target.ContentID)
	if err != nil {
		return nil, false, err
	}
	if !sameInstant(current.UpdatedAt, expected) {
		return nil, false, apperr.Conflict(staleMessage)
	}
	if hash(content) == current.ContentHash {
		return target, false, nil
	}
	if err = s.repo.updateContent(ctx, current.ID, content, hash(content)); err != nil {
		return nil, false, err
	}
	s.narrate(ctx, id, content)

	return target, true, nil
}

// UpdateMetadata changes the title of a chapter if nobody else changed the chapter since the client read it at expected. The input is already normalized.
func (s *Service) UpdateMetadata(ctx context.Context, viewer auth.Viewer, id uuid.UUID, input UpdateInput, expected time.Time) (*ent.Chapter, error) {
	target, err := s.authorizedChapter(ctx, viewer, auth.Update, id)
	if err != nil {
		return nil, err
	}
	if !sameInstant(target.UpdatedAt, expected) {
		return nil, apperr.Conflict(staleMessage)
	}

	return s.repo.updateTitle(ctx, id, input.Title)
}

// Deleted is what Delete leaves behind for the caller to clean up outside the database.
type Deleted struct {
	ID           uuid.UUID
	NovelID      uuid.UUID
	NarrationURL *string
}

// Delete removes a chapter and its content, and renumbers the later chapters of the novel down by one.
func (s *Service) Delete(ctx context.Context, viewer auth.Viewer, id uuid.UUID) (Deleted, error) {
	var deleted Deleted
	err := entx.WithTx(ctx, s.client, func(tx *ent.Tx) error {
		repo := newRepository(tx.Client())
		doomed, err := lockedChapter(ctx, repo, viewer, id)
		if err != nil {
			return err
		}
		if err = repo.deleteChapter(ctx, doomed); err != nil {
			return err
		}
		deleted = Deleted{ID: doomed.ID, NovelID: doomed.NovelID, NarrationURL: doomed.NarrationURL}

		return nil
	})

	return deleted, err
}

// lockedChapter finds the chapter, takes the lock of its novel, checks the viewer may delete it and reads it again:
// a concurrent delete may have removed or renumbered it while this one waited for the lock.
func lockedChapter(ctx context.Context, repo *repository, viewer auth.Viewer, id uuid.UUID) (*ent.Chapter, error) {
	found, err := repo.chapter(ctx, id)
	if err != nil {
		return nil, notFound(err)
	}
	target, err := lockedNovel(ctx, repo, found.NovelID)
	if err != nil {
		return nil, err
	}
	if err = authorize(viewer, auth.Delete, target); err != nil {
		return nil, err
	}
	doomed, err := repo.chapter(ctx, id)

	return doomed, notFound(err)
}

// lockedNovel locks the novel and answers NOT_FOUND when there is none.
func lockedNovel(ctx context.Context, repo *repository, id uuid.UUID) (*ent.Novel, error) {
	locked, err := repo.lockNovel(ctx, id)
	if ent.IsNotFound(err) {
		return nil, apperr.NotFound("Novel not found")
	}

	return locked, err
}

// authorizedChapter loads a chapter and checks the viewer may do action on it.
func (s *Service) authorizedChapter(ctx context.Context, viewer auth.Viewer, action auth.Action, id uuid.UUID) (*ent.Chapter, error) {
	target, err := s.repo.chapterWithOwner(ctx, id)
	if err != nil {
		return nil, notFound(err)
	}

	return target, authorize(viewer, action, target.Edges.Novel)
}

// Get returns a chapter of a novel; nil when the novel has no such chapter.
func (s *Service) Get(ctx context.Context, novelID, id uuid.UUID) (*ent.Chapter, error) {
	return s.repo.chapterOfNovel(ctx, novelID, id)
}

// First is the chapter with the lowest number of a novel, nil when it has none.
func (s *Service) First(ctx context.Context, novelID uuid.UUID) (*ent.Chapter, error) {
	return s.repo.firstChapter(ctx, novelID)
}

// Last is the chapter with the highest number of a novel, nil when it has none.
func (s *Service) Last(ctx context.Context, novelID uuid.UUID) (*ent.Chapter, error) {
	return s.repo.lastChapter(ctx, novelID)
}

func authorize(viewer auth.Viewer, action auth.Action, owning *ent.Novel) error {
	return auth.DenyUnlessCan(viewer, action, auth.Chapter{NovelOwnerUserID: owning.Edges.Writer.UserID})
}

func hash(content string) string {
	sum := sha256.Sum256([]byte(content))

	return hex.EncodeToString(sum[:])
}

func sameInstant(stored, sent time.Time) bool {
	return stored.Truncate(storedPrecision).Equal(sent.Truncate(storedPrecision))
}

func notFound(err error) error {
	if ent.IsNotFound(err) {
		return apperr.NotFound(notFoundMessage)
	}

	return err
}
