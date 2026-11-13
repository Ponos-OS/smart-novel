// Package novel holds the rules for novels: who may change them, which tags and license they get, and how they are listed.
package novel

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/ent"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/apperr"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/auth"
	"github.com/Ponos-OS/smart-novel/apps/backend/internal/entx"
)

const notFoundMessage = "Novel not found"

// RowEstimator tells how many rows a query would return, from the planner, without running it.
type RowEstimator interface {
	EstimateRows(ctx context.Context, query string, args ...any) (int, error)
}

// Service decides who may change what and which tags and license a novel gets; the queries are in the repository.
type Service struct {
	client    *ent.Client
	repo      *repository
	estimator RowEstimator
}

func NewService(client *ent.Client, estimator RowEstimator) *Service {
	return &Service{client: client, repo: newRepository(client), estimator: estimator}
}

// Get returns a novel, or the not found error.
func (s *Service) Get(ctx context.Context, id uuid.UUID) (*ent.Novel, error) {
	found, err := s.repo.novel(ctx, id)
	if ent.IsNotFound(err) {
		return nil, apperr.NotFound(notFoundMessage)
	}

	return found, err
}

// Create makes a novel owned by the viewer, with the default license. The input is already normalized.
func (s *Service) Create(ctx context.Context, viewer auth.Viewer, input CreateInput) (*ent.Novel, error) {
	if err := auth.DenyUnlessCan(viewer, auth.Create, auth.Novel{}); err != nil {
		return nil, err
	}

	var createdID uuid.UUID
	err := entx.WithTx(ctx, s.client, func(tx *ent.Tx) error {
		repo := newRepository(tx.Client())
		tagIDs, err := approvedTagIDs(ctx, repo, input.Tags)
		if err != nil {
			return err
		}
		owner, err := repo.writerID(ctx, viewer.Subject)
		if err != nil {
			return fmt.Errorf("user %s creates a novel but has no writer row: %w", viewer.Subject, err)
		}
		defaultLicense, err := repo.defaultLicenseID(ctx)
		if err != nil {
			return fmt.Errorf("finding the default license: %w", err)
		}
		created, err := repo.createNovel(ctx, input, owner, defaultLicense, tagIDs)
		if err != nil {
			return err
		}
		createdID = created.ID

		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.repo.novel(ctx, createdID)
}

// Update changes the given fields of a novel its owner or an admin owns. The input is already normalized.
func (s *Service) Update(ctx context.Context, viewer auth.Viewer, id uuid.UUID, input UpdateInput) (*ent.Novel, error) {
	err := entx.WithTx(ctx, s.client, func(tx *ent.Tx) error {
		repo := newRepository(tx.Client())
		if _, err := authorizedNovel(ctx, repo, viewer, auth.Update, id, false); err != nil {
			return err
		}
		var tagIDs []uuid.UUID
		if input.Tags != nil {
			var err error
			if tagIDs, err = approvedTagIDs(ctx, repo, input.Tags); err != nil {
				return err
			}
		}

		return repo.updateNovel(ctx, id, input, input.Tags != nil, tagIDs)
	})
	if err != nil {
		return nil, err
	}

	return s.repo.novel(ctx, id)
}

// Deleted is what Delete leaves behind for the caller to clean up outside the database.
type Deleted struct {
	CoverURL      *string
	NarrationURLs []string
}

// Delete removes a novel with its chapters, their contents and their read history.
func (s *Service) Delete(ctx context.Context, viewer auth.Viewer, id uuid.UUID) (Deleted, error) {
	var deleted Deleted
	err := entx.WithTx(ctx, s.client, func(tx *ent.Tx) error {
		repo := newRepository(tx.Client())
		// The lock createChapter takes too, so a chapter being added cannot slip in mid-delete.
		found, err := authorizedNovel(ctx, repo, viewer, auth.Delete, id, true)
		if err != nil {
			return err
		}
		chapters, err := repo.chaptersOf(ctx, id)
		if err != nil {
			return err
		}
		deleted = leftBehind(found, chapters)

		return repo.deleteNovel(ctx, id, contentIDs(chapters))
	})

	return deleted, err
}

func leftBehind(found *ent.Novel, chapters []*ent.Chapter) Deleted {
	deleted := Deleted{CoverURL: found.CoverURL}
	for _, chapter := range chapters {
		if chapter.NarrationURL != nil {
			deleted.NarrationURLs = append(deleted.NarrationURLs, *chapter.NarrationURL)
		}
	}

	return deleted
}

func contentIDs(chapters []*ent.Chapter) []uuid.UUID {
	ids := make([]uuid.UUID, len(chapters))
	for index, chapter := range chapters {
		ids[index] = chapter.ContentID
	}

	return ids
}

// EstimateChapterCount is the planner's estimate of the chapters of a novel, never an exact count.
func (s *Service) EstimateChapterCount(ctx context.Context, id uuid.UUID) (int, error) {
	return s.estimator.EstimateRows(ctx, "SELECT 1 FROM chapters WHERE novel_id = $1", id)
}

// authorizedNovel loads the novel and checks the viewer may do action on it. A novel that does not exist is answered the same way for everybody.
func authorizedNovel(ctx context.Context, repo *repository, viewer auth.Viewer, action auth.Action, id uuid.UUID, lock bool) (*ent.Novel, error) {
	found, err := repo.novelWithWriter(ctx, id, lock)
	if ent.IsNotFound(err) {
		return nil, apperr.NotFound(notFoundMessage)
	}
	if err != nil {
		return nil, err
	}
	if err := auth.DenyUnlessCan(viewer, action, auth.Novel{OwnerUserID: found.Edges.Writer.UserID}); err != nil {
		return nil, err
	}

	return found, nil
}

// approvedTagIDs finds the approved tags by name, which compares without regard to case. Any name that is not an approved tag fails the whole call.
func approvedTagIDs(ctx context.Context, repo *repository, names []string) ([]uuid.UUID, error) {
	if len(names) == 0 {
		return nil, nil
	}
	approved, err := repo.approvedTags(ctx, names)
	if err != nil {
		return nil, err
	}
	found := make(map[string]bool, len(approved))
	ids := make([]uuid.UUID, len(approved))
	for index, approvedTag := range approved {
		found[strings.ToLower(approvedTag.Name)] = true
		ids[index] = approvedTag.ID
	}
	var unavailable []string
	for _, name := range names {
		if !found[strings.ToLower(name)] {
			unavailable = append(unavailable, name)
		}
	}
	if len(unavailable) > 0 {
		return nil, apperr.BadRequest(fmt.Sprintf("These tags are not available: %s. Request a new tag and add it once an admin approved it.", strings.Join(unavailable, ", ")))
	}

	return ids, nil
}
